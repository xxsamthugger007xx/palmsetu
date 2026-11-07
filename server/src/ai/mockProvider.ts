import { AiProvider, ChatMessage } from './types';

/** Deterministic offline provider used when no ANTHROPIC_API_KEY is set, so the
 * server and app can be run end-to-end without live credentials. */
export class MockProvider implements AiProvider {
  async complete(messages: ChatMessage[]): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return `[mock reply] I heard: "${lastUser?.content ?? ''}". Configure ANTHROPIC_API_KEY to get real responses.`;
  }
}
