import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { SqliteMap } from '../data/sqliteCollections';
import { getUserTier } from '../data/store';

/**
 * Per-user monthly AI spend cap for PREMIUM users (default Rs 100/month).
 *
 * - Who is calling is carried in an AsyncLocalStorage set by `runWithAiUser` middleware, so the shared
 *   UsageTrackingProvider can attribute cost without changing any feature's call sites.
 * - Cost is an ESTIMATE: token counts come from the provider wrapper (~4 chars/token) and the prices
 *   below are configurable assumptions, not a bill. Tune via env to match real Gemini pricing.
 * - Month = calendar month in UTC. Free users are not capped here (they have per-feature quotas).
 */

const userCtx = new AsyncLocalStorage<{ userId: string }>();

export class AiBudgetExceededError extends Error {
  readonly code = 'AI_BUDGET_EXCEEDED';
  constructor(public limitInr: number) {
    super(`You have reached this month's AI usage limit (Rs ${limitInr}). It resets at the start of next month.`);
  }
}

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export type ProviderKey = 'gemini' | 'anthropic' | 'mock';
// USD per 1M tokens (thinking tokens bill as output). Gemini 3.5 Flash-Lite standard tier; Claude Haiku 5.5 (prompts <= 100K).
const PROVIDER_PRICES: Record<ProviderKey, { in: number; out: number }> = {
  gemini: { in: 0.3, out: 2.5 }, anthropic: { in: 0.1, out: 0.5 }, mock: { in: 0.3, out: 2.5 },
};
let activeProvider: ProviderKey = 'gemini';
/** Default provider for cost estimates (the active text provider, set once at startup). */
export function setBudgetProvider(name: ProviderKey): void { activeProvider = name; }

/** Maps a provider class/model name (e.g. 'AnthropicProvider', 'GeminiProvider') to its price table. */
export function providerKeyFromName(name: string | undefined): ProviderKey {
  const n = (name ?? '').toLowerCase();
  return n.includes('anthropic') || n.includes('claude') ? 'anthropic' : n.includes('gemini') ? 'gemini' : activeProvider;
}

/** Prices can be overridden per provider: AI_GEMINI_INPUT_USD_PER_MTOK, AI_ANTHROPIC_OUTPUT_USD_PER_MTOK, etc. */
export function budgetConfig(provider: ProviderKey = activeProvider) {
  const P = provider.toUpperCase();
  return {
    limitInr: num(process.env.AI_MONTHLY_BUDGET_INR_PREMIUM, 100),
    inputUsdPerMTok: num(process.env[`AI_${P}_INPUT_USD_PER_MTOK`], PROVIDER_PRICES[provider].in),
    outputUsdPerMTok: num(process.env[`AI_${P}_OUTPUT_USD_PER_MTOK`], PROVIDER_PRICES[provider].out),
    usdToInr: num(process.env.AI_USD_INR, 88),
    // Thinking tokens are billed as output but are not visible in the reply text.
    outputMultiplier: num(process.env.AI_OUTPUT_TOKEN_MULTIPLIER, 1.5),
  };
}

/** `actual` = token counts reported by the provider (already include thinking tokens); otherwise they are
 * text-length guesses and output is padded by outputMultiplier to cover hidden thinking tokens. */
export function estimateCostInr(inputTokens: number, outputTokens: number, actual = false, provider: ProviderKey = activeProvider): number {
  const c = budgetConfig(provider);
  const usd = (inputTokens * c.inputUsdPerMTok + outputTokens * (actual ? 1 : c.outputMultiplier) * c.outputUsdPerMTok) / 1_000_000;
  return usd * c.usdToInr;
}

type Spend = { userId: string; month: string; costInr: number; calls: number; byProvider?: Partial<Record<ProviderKey, number>> };
const spendByKey = new SqliteMap<string, Spend>('aiMonthlySpend', { userId: (v) => v.userId });

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const key = (userId: string, month: string) => `${userId}:${month}`;

export function getMonthlySpendInr(userId: string, month = monthKey()): number {
  return spendByKey.get(key(userId, month))?.costInr ?? 0;
}

/** One combined counter per user per month across ALL providers (Claude + Gemini), with a per-provider breakdown. */
export function addSpend(userId: string, costInr: number, provider: ProviderKey = activeProvider): void {
  const month = monthKey();
  const k = key(userId, month);
  const cur = spendByKey.get(k) ?? { userId, month, costInr: 0, calls: 0 };
  const byProvider = { ...(cur.byProvider ?? {}), [provider]: (cur.byProvider?.[provider] ?? 0) + costInr };
  spendByKey.set(k, { ...cur, costInr: cur.costInr + costInr, calls: cur.calls + 1, byProvider });
}

export function getBudgetStatus(userId: string) {
  const { limitInr } = budgetConfig();
  const capped = getUserTier(userId) === 'premium';
  const used = getMonthlySpendInr(userId);
  return {
    capped,
    limitInr: capped ? limitInr : null,
    usedInr: Math.round(used * 100) / 100,
    remainingInr: capped ? Math.max(0, Math.round((limitInr - used) * 100) / 100) : null,
    byProviderInr: Object.fromEntries(Object.entries(spendByKey.get(key(userId, monthKey()))?.byProvider ?? {}).map(([k, v]) => [k, Math.round((v as number) * 100) / 100])),
    resetsOn: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
  };
}

/** Free plan: how many AI chat messages per day, and the most AI spend (all features) a free user may reach this month before chat falls back to template answers. */
export function freeChatLimits() {
  return { dailyMessages: num(process.env.AI_FREE_CHAT_DAILY_MESSAGES, 5), monthlyInr: num(process.env.AI_FREE_CHAT_MONTHLY_INR, 10) };
}

export function isOverBudget(userId: string): boolean {
  if (getUserTier(userId) !== 'premium') return false;
  return getMonthlySpendInr(userId) >= budgetConfig().limitInr;
}

export function currentAiUserId(): string | undefined {
  return userCtx.getStore()?.userId;
}

/** Express middleware: makes the caller's id available to the AI provider layer. */
export function runWithAiUser(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.auth?.userId;
  if (!userId) return next();
  userCtx.run({ userId }, next);
}

/** Express middleware: refuses AI-generating requests up front once a premium user is over budget. */
export function enforceAiBudget(req: Request, res: Response, next: NextFunction): void {
  const userId = req.auth?.userId;
  if (userId && isOverBudget(userId)) {
    const err = new AiBudgetExceededError(budgetConfig().limitInr);
    res.status(429).json({ error: err.message, code: err.code });
    return;
  }
  next();
}
