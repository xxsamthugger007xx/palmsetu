import { AiProvider, ChatMessage } from './types';

/**
 * Anthropic-backed provider. The API key lives only in server env vars
 * (ANTHROPIC_API_KEY) - never shipped to the mobile client.
 *
 * This is a minimal fetch-based implementation so the server has no hard
 * dependency on the Anthropic SDK; swap for the official SDK if preferred.
 */
export class AnthropicProvider implements AiProvider {
  constructor(
    private apiKey: string = process.env.ANTHROPIC_API_KEY ?? '',
    private model: string = 'claude-sonnet-5'
  ) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
    }

    const system = messages.find((m) => m.role === 'system')?.content;
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: rest,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { content?: { text?: string }[] };
    return data.content?.[0]?.text ?? '';
  }
}
