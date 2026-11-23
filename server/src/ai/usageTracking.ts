import { AiProvider, ChatMessage, GenerationOptions } from './types';
import { recordAiUsage } from '../data/store';
import { recordEvent } from '../events/eventTracker';
import { addSpend, AiBudgetExceededError, budgetConfig, currentAiUserId, estimateCostInr, isOverBudget, providerKeyFromName } from './budget';

/**
 * Shared, feature-agnostic AI usage tracker - wraps the single app-wide
 * AiProvider instance once in index.ts, so every feature that already calls
 * `aiProvider.complete(...)` (Tarot, Palm Reading, Astrology, Gemstone,
 * Vastu, the global Assistant, Soulmate Sketch's personality text, etc.)
 * is instrumented automatically with zero per-feature tracking code. This
 * is intentionally NOT a Tarot-specific quota/cost system - it exists
 * precisely so no feature ever needs to build its own.
 *
 * Token counts are estimates (~4 chars/token, the same rough heuristic used
 * for the manual audit of this module) since none of the wrapped providers
 * currently return real usage metadata from their API responses - this is
 * honestly labeled as an estimate everywhere it's surfaced (see
 * routes/admin.ts's aiUsage endpoint), never presented as an exact bill.
 */
export class UsageTrackingProvider implements AiProvider {
  readonly innerProviderName: string;
  streamComplete?: (messages: ChatMessage[], onChunk: (text: string) => void, options?: GenerationOptions) => Promise<string>;

  constructor(private inner: AiProvider) {
    this.innerProviderName = (inner as any).innerProviderName ?? inner.constructor.name;

    if (inner.streamComplete) {
      this.streamComplete = async (messages, onChunk, options) => {
        this.assertWithinBudget();
        const startedAt = Date.now();
        const cap = withUsageCapture(options);
        const opts = cap.opts;
        try {
          const full = await inner.streamComplete!(messages, onChunk, opts);
          this.record(messages, full, options, startedAt, true, cap.real);
          return full;
        } catch (err) {
          this.record(messages, '', options, startedAt, false, cap.real);
          throw err;
        }
      };
    }
  }

  /** Backstop for call paths that bypass the request-level gate (e.g. background jobs in a user's context). */
  private assertWithinBudget() {
    const userId = currentAiUserId();
    if (userId && isOverBudget(userId)) throw new AiBudgetExceededError(budgetConfig().limitInr);
  }

  async complete(messages: ChatMessage[], options?: GenerationOptions): Promise<string> {
    this.assertWithinBudget();
    const startedAt = Date.now();
    const cap = withUsageCapture(options);
        const opts = cap.opts;
    try {
      const result = await this.inner.complete(messages, opts);
      this.record(messages, result, options, startedAt, true, cap.real);
      return result;
    } catch (err) {
      this.record(messages, '', options, startedAt, false, cap.real);
      throw err;
    }
  }

  private record(messages: ChatMessage[], output: string, options: GenerationOptions | undefined, startedAt: number, success: boolean, real?: { inputTokens: number; outputTokens: number }) {
    const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const feature = options?.feature ?? 'unspecified';
    const operation = options?.operation ?? 'unspecified';
    // Prefer the provider's real token counts (Gemini usageMetadata); fall back to ~4 chars/token.
    const estimatedInputTokens = real ? real.inputTokens : Math.ceil(inputChars / 4);
    const estimatedOutputTokens = real ? real.outputTokens : Math.ceil(output.length / 4);
    const latencyMs = Date.now() - startedAt;
    const aiUserId = currentAiUserId();
    if (aiUserId && success) { const pk = providerKeyFromName(this.innerProviderName); addSpend(aiUserId, estimateCostInr(estimatedInputTokens, estimatedOutputTokens, !!real, pk), pk); }
    recordAiUsage({ feature, operation, model: this.innerProviderName, estimatedInputTokens, estimatedOutputTokens, latencyMs, success, tokenSource: real ? 'actual' : 'estimated' });

    // No userId here: GenerationOptions doesn't carry one today, and
    // threading it through every call site across every feature route is
    // out of scope for this pass. These events are still useful for
    // feature/model-level cost and failure-rate dashboards and the Live
    // Activity feed; per-user AI cost attribution needs that follow-up.
    recordEvent({
      userId: null,
      eventType: success ? 'AI_REQUEST_COMPLETED' : 'AI_REQUEST_FAILED',
      feature,
      status: success ? 'success' : 'failure',
      metadata: { operation, model: this.innerProviderName, estimatedInputTokens, estimatedOutputTokens, latencyMs },
    });
  }
}

/** Wraps options so the provider's real token counts (if it reports any) are captured for billing. */
function withUsageCapture(options?: GenerationOptions) {
  const real: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 };
  let seen = false;
  const opts: GenerationOptions = {
    ...options,
    onUsage: (u) => { seen = true; real.inputTokens = u.inputTokens; real.outputTokens = u.outputTokens; options?.onUsage?.(u); },
  };
  return { opts, get real() { return seen ? real : undefined; } };
}
