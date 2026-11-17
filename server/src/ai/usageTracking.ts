import { AiProvider, ChatMessage, GenerationOptions } from './types';
import { recordAiUsage } from '../data/store';
import { recordEvent } from '../events/eventTracker';

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
        const startedAt = Date.now();
        try {
          const full = await inner.streamComplete!(messages, onChunk, options);
          this.record(messages, full, options, startedAt, true);
          return full;
        } catch (err) {
          this.record(messages, '', options, startedAt, false);
          throw err;
        }
      };
    }
  }

  async complete(messages: ChatMessage[], options?: GenerationOptions): Promise<string> {
    const startedAt = Date.now();
    try {
      const result = await this.inner.complete(messages, options);
      this.record(messages, result, options, startedAt, true);
      return result;
    } catch (err) {
      this.record(messages, '', options, startedAt, false);
      throw err;
    }
  }

  private record(messages: ChatMessage[], output: string, options: GenerationOptions | undefined, startedAt: number, success: boolean) {
    const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const feature = options?.feature ?? 'unspecified';
    const operation = options?.operation ?? 'unspecified';
    const estimatedInputTokens = Math.ceil(inputChars / 4);
    const estimatedOutputTokens = Math.ceil(output.length / 4);
    const latencyMs = Date.now() - startedAt;
    recordAiUsage({ feature, operation, model: this.innerProviderName, estimatedInputTokens, estimatedOutputTokens, latencyMs, success });

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
