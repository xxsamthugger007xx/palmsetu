import { AiProvider, ChatMessage, GenerationOptions } from './types';

/**
 * Anthropic (Claude) provider, default model Claude Haiku 5.5. The API key lives only in server
 * env vars (ANTHROPIC_API_KEY) - never shipped to the mobile client. Plain fetch, no SDK dependency.
 *
 * Mapping from the app's provider-neutral GenerationOptions:
 * - maxOutputTokens -> max_tokens, plus headroom: on Claude, thinking tokens count against max_tokens, so a
 *   reply-sized cap alone could be consumed by thinking and truncate the answer.
 * - thinkingLevel   -> output_config.effort ('low' | 'medium' | 'high'); thinking itself stays adaptive.
 * - Real usage (input + output incl. thinking) is reported through options.onUsage so the per-user budget
 *   in ai/budget.ts counts actual tokens.
 * Haiku 5.5 rejects non-default sampling params, so none are sent.
 */
const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const DEFAULT_MAX_OUTPUT = 800;
const THINKING_HEADROOM = 1500;
const MAX_TOKENS_CEILING = 16000;
const REQUEST_TIMEOUT_MS = 60_000;

type ApiMessage = { role: 'user' | 'assistant'; content: string };

/** Exported for tests. System messages are joined into the top-level `system`; the rest must start with a user turn. */
export function toAnthropicPayload(messages: ChatMessage[]): { system?: string; messages: ApiMessage[] } {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') || undefined;
  const rest: ApiMessage[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  if (rest.length === 0 || rest[0].role !== 'user') rest.unshift({ role: 'user', content: rest.length === 0 ? 'Hello' : '(conversation continues)' });
  return { system, messages: rest };
}

export class AnthropicProvider implements AiProvider {
  constructor(
    private apiKey: string = process.env.ANTHROPIC_API_KEY ?? '',
    private model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL
  ) {}

  private body(messages: ChatMessage[], options: GenerationOptions | undefined, stream: boolean) {
    const { system, messages: msgs } = toAnthropicPayload(messages);
    const maxTokens = Math.min(MAX_TOKENS_CEILING, (options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT) + THINKING_HEADROOM);
    return JSON.stringify({
      model: this.model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: msgs,
      output_config: { effort: options?.thinkingLevel ?? 'low' },
      ...(stream ? { stream: true } : {}),
    });
  }

  private headers() {
    return { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' };
  }

  async complete(messages: ChatMessage[], options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(API_URL, { method: 'POST', headers: this.headers(), body: this.body(messages, options, false), signal: controller.signal });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Anthropic request timed out.');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text().catch(() => '')}`);

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };
    if (data.usage) {
      options?.onUsage?.({
        inputTokens: (data.usage.input_tokens ?? 0) + (data.usage.cache_read_input_tokens ?? 0) + (data.usage.cache_creation_input_tokens ?? 0),
        outputTokens: data.usage.output_tokens ?? 0,
      });
    }
    if (data.stop_reason === 'refusal') throw new Error('The AI declined to answer this request.');
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  }

  async streamComplete(messages: ChatMessage[], onChunk: (text: string) => void, options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(API_URL, { method: 'POST', headers: this.headers(), body: this.body(messages, options, true), signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new Error('Anthropic stream request timed out.');
      throw err;
    }
    if (!res.ok) {
      clearTimeout(timeout);
      throw new Error(`Anthropic API error: ${res.status} ${await res.text().catch(() => '')}`);
    }
    if (!res.body) {
      clearTimeout(timeout);
      throw new Error('Anthropic streaming response had no body.');
    }

    let full = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let refused = false;
    let buffer = '';
    const handle = (line: string) => {
      const t = line.trim();
      if (!t.startsWith('data:')) return;
      const json = t.slice(5).trim();
      if (!json) return;
      try {
        const ev = JSON.parse(json);
        if (ev.type === 'message_start') {
          const u = ev.message?.usage ?? {};
          inputTokens = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
          outputTokens = u.output_tokens ?? 0;
        } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          full += ev.delta.text;
          onChunk(ev.delta.text);
        } else if (ev.type === 'message_delta') {
          if (ev.usage?.output_tokens != null) outputTokens = ev.usage.output_tokens; // cumulative
          if (ev.delta?.stop_reason === 'refusal') refused = true;
        } else if (ev.type === 'error') {
          throw new Error(`Anthropic stream error: ${ev.error?.message ?? 'unknown'}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Anthropic stream error')) throw e;
        // partial / non-JSON frame: ignore
      }
    };

    try {
      const decoder = new TextDecoder();
      for await (const chunk of res.body as any) {
        buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const l of lines) handle(l);
      }
      if (buffer) handle(buffer);
    } finally {
      clearTimeout(timeout);
    }

    if (inputTokens || outputTokens) options?.onUsage?.({ inputTokens, outputTokens });
    if (refused) throw new Error('The AI declined to answer this request.');
    if (!full) throw new Error('Anthropic stream produced no content.');
    return full;
  }
}
