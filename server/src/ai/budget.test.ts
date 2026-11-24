import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { userPlans } from '../data/store';
import { addSpend, getMonthlySpendInr, estimateCostInr, getBudgetStatus, isOverBudget, enforceAiBudget, runWithAiUser, currentAiUserId, AiBudgetExceededError } from './budget';
import { UsageTrackingProvider } from './usageTracking';
import { MockProvider } from './mockProvider';

const premium = () => { const id = `user-${uuid()}`; userPlans.set(id, { userId: id, tier: 'premium' } as any); return id; };

beforeEach(() => { delete process.env.AI_MONTHLY_BUDGET_INR_PREMIUM; });

describe('AI monthly budget (premium)', () => {
  it('estimates cost in rupees from tokens', () => {
    expect(estimateCostInr(0, 0)).toBe(0);
    expect(estimateCostInr(1_000_000, 0)).toBeCloseTo(0.3 * 88, 5);
  });

  it('caps premium users at Rs 100 by default, and free users at the smaller free allowance', () => {
    const p = premium(); const f = `user-${uuid()}`;
    addSpend(p, 99.9); addSpend(f, 1000);
    expect(isOverBudget(p)).toBe(false);
    addSpend(p, 0.2);
    expect(isOverBudget(p)).toBe(true);
    expect(isOverBudget(f)).toBe(true); // Rs 1000 is far past the Rs 25 free allowance
    expect(isOverBudget(`user-${uuid()}`)).toBe(false);
    expect(getBudgetStatus(p)).toMatchObject({ capped: true, limitInr: 100, remainingInr: 0 });
  });

  it('limit is configurable via env', () => {
    const p = premium(); process.env.AI_MONTHLY_BUDGET_INR_PREMIUM = '5';
    addSpend(p, 5.01); expect(isOverBudget(p)).toBe(true);
  });

  it('middleware returns 429 AI_BUDGET_EXCEEDED once over budget and passes otherwise', async () => {
    const over = premium(); addSpend(over, 150); const fine = premium();
    const app = express();
    app.use((req, _res, next) => { req.auth = { userId: String(req.headers['x-u']), isGuest: false }; next(); });
    app.post('/x', enforceAiBudget, (_req, res) => res.json({ ok: true }));
    const a = await request(app).post('/x').set('x-u', over); expect(a.status).toBe(429); expect(a.body.code).toBe('AI_BUDGET_EXCEEDED');
    expect((await request(app).post('/x').set('x-u', fine)).status).toBe(200);
  });

  it('provider records spend for the request user and blocks once over budget', async () => {
    const p = premium(); process.env.AI_MONTHLY_BUDGET_INR_PREMIUM = '0.0000001';
    const provider = new UsageTrackingProvider(new MockProvider());
    const app = express();
    app.use((req, _res, next) => { req.auth = { userId: p, isGuest: false }; next(); }, runWithAiUser);
    app.get('/ai', async (_req, res) => {
      expect(currentAiUserId()).toBe(p);
      try { res.json({ reply: await provider.complete([{ role: 'user', content: 'hello world '.repeat(200) }]) }); }
      catch (e) { res.status(e instanceof AiBudgetExceededError ? 429 : 500).json({ code: (e as any).code }); }
    });
    expect((await request(app).get('/ai')).status).toBe(200);   // first call allowed, spend recorded
    expect(getBudgetStatus(p).usedInr).toBeGreaterThanOrEqual(0);
    process.env.AI_MONTHLY_BUDGET_INR_PREMIUM = '0';
    const blocked = await request(app).get('/ai'); expect(blocked.status).toBe(429); expect(blocked.body.code).toBe('AI_BUDGET_EXCEEDED');
  });
});

describe('real provider token counts', () => {
  it('uses onUsage counts (incl. thinking) instead of the text-length guess and tags the event as actual', async () => {
    const p = premium();
    const fake = { async complete(_m: any, o: any) { o?.onUsage?.({ inputTokens: 1000, outputTokens: 2000 }); return 'ok'; } };
    const provider = new UsageTrackingProvider(fake as any);
    const { aiUsageEvents } = await import('../data/store');
    const before = aiUsageEvents.length;
    const app = express();
    app.use((req, _res, next) => { req.auth = { userId: p, isGuest: false }; next(); }, runWithAiUser);
    app.get('/ai', async (_req, res) => res.json({ r: await provider.complete([{ role: 'user', content: 'hi' }], { feature: 't' }) }));
    await request(app).get('/ai');
    const ev = aiUsageEvents[aiUsageEvents.length - 1];
    expect(aiUsageEvents.length).toBe(before + 1);
    expect(ev).toMatchObject({ estimatedInputTokens: 1000, estimatedOutputTokens: 2000, tokenSource: 'actual' });
    expect(getMonthlySpendInr(p)).toBeCloseTo(estimateCostInr(1000, 2000, true), 6);
  });
});

describe('combined Claude + Gemini cap', () => {
  it('prices each provider with its own table', () => {
    expect(estimateCostInr(1_000_000, 0, true, 'gemini')).toBeCloseTo(0.3 * 88, 5);
    expect(estimateCostInr(1_000_000, 0, true, 'anthropic')).toBeCloseTo(0.1 * 88, 5);
    expect(estimateCostInr(0, 1_000_000, true, 'gemini')).toBeCloseTo(2.5 * 88, 5);
    expect(estimateCostInr(0, 1_000_000, true, 'anthropic')).toBeCloseTo(0.5 * 88, 5);
  });
  it('one Rs 100 pot: Claude and Gemini spend add up and block together', () => {
    const p = premium();
    addSpend(p, 60, 'anthropic');
    expect(isOverBudget(p)).toBe(false);
    addSpend(p, 39, 'gemini');
    const s = getBudgetStatus(p);
    expect(s.usedInr).toBe(99);
    expect(s.byProviderInr).toEqual({ anthropic: 60, gemini: 39 });
    expect(isOverBudget(p)).toBe(false);
    addSpend(p, 1.5, 'gemini');
    expect(isOverBudget(p)).toBe(true);
  });
  it('maps provider class names to price tables', async () => {
    const { providerKeyFromName } = await import('./budget');
    expect(providerKeyFromName('AnthropicProvider')).toBe('anthropic');
    expect(providerKeyFromName('GeminiProvider')).toBe('gemini');
  });
});
