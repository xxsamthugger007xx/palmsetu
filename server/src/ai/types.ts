export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Optional per-call generation tuning, used by the assistant's FAST vs
 * DEEP_ANALYSIS mode split (see server/src/assistant/modeClassifier.ts).
 * Providers that don't support a given knob (MockProvider, AnthropicProvider
 * today) simply ignore it - this is advisory, not a contract every provider
 * must honor.
 */
export interface GenerationOptions {
  maxOutputTokens?: number;
  /** Gemini-specific thinking depth. Verified live against gemini-3.5-flash-lite
   * on 2026-10-31: 'low', 'medium', and 'high' are all accepted; 'low' is the
   * cheapest/fastest available (thinkingBudget: 0 is rejected outright by
   * this model family). Other providers ignore this field. */
  thinkingLevel?: 'low' | 'medium' | 'high';
}

/** Replaceable AI provider contract. Swap implementations without touching callers. */
export interface AiProvider {
  complete(messages: ChatMessage[], options?: GenerationOptions): Promise<string>;
  /**
   * Optional streaming variant. Providers that cannot stream (MockProvider,
   * AnthropicProvider today) simply do not implement it - callers must check
   * `typeof provider.streamComplete === 'function'` and fall back to
   * `.complete()` otherwise. `onChunk` is called with each new text fragment
   * as it arrives; the returned promise resolves with the full concatenated
   * text once the stream ends.
   */
  streamComplete?(messages: ChatMessage[], onChunk: (text: string) => void, options?: GenerationOptions): Promise<string>;
}
