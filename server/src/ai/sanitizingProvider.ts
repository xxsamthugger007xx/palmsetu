import { AiProvider, ChatMessage, GenerationOptions } from './types';

/**
 * Wraps any AiProvider and strips em dashes (U+2014) from its output.
 *
 * Standing project rule: no em dash anywhere in this app's content, ever.
 * System prompts also ask the model not to use one, but model instructions
 * are not reliably followed, so this wrapper is the actual enforcement point
 * - every real AI reply passes through here before reaching any route,
 * regardless of which provider (Gemini, Anthropic, future providers) is
 * active. Replaced with " - " to match the hyphen style already used
 * throughout this codebase's own prose.
 */
export class SanitizingProvider implements AiProvider {
  /** The wrapped provider's class name, so callers that report "which
   * provider is active" (e.g. the admin system endpoint) see the real
   * provider instead of always seeing "SanitizingProvider". */
  readonly innerProviderName: string;

  /**
   * Only present when the inner provider supports streaming. Sanitizes each
   * chunk's text individually before forwarding it to the caller's onChunk -
   * this is the real enforcement point for the no-em-dash rule on the
   * streaming path, not just on the final concatenated text.
   */
  streamComplete?: (messages: ChatMessage[], onChunk: (text: string) => void, options?: GenerationOptions) => Promise<string>;

  constructor(private inner: AiProvider) {
    this.innerProviderName = inner.constructor.name;
    if (inner.streamComplete) {
      this.streamComplete = async (messages, onChunk, options) => {
        let full = '';
        await inner.streamComplete!(messages, (chunk) => {
          const clean = sanitize(chunk);
          full += clean;
          if (clean) onChunk(clean);
        }, options);
        // Defensive re-sanitize in case a dash got split across a chunk
        // boundary (e.g. " —" split into " " then "—").
        return sanitize(full);
      };
    }
  }

  async complete(messages: ChatMessage[], options?: GenerationOptions): Promise<string> {
    const raw = await this.inner.complete(messages, options);
    return sanitize(raw);
  }
}

function sanitize(text: string): string {
  return text.replace(/—/g, ' - ').replace(/ {2,}/g, ' ');
}
