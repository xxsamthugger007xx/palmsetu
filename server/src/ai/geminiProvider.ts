import { AiProvider, ChatMessage, GenerationOptions } from './types';

/**
 * Google Gemini-backed provider. The API key lives only in server env vars
 * (GEMINI_API_KEY) - never shipped to the mobile client.
 *
 * Minimal fetch-based implementation so the server has no hard dependency on
 * the Gemini SDK, matching the style of AnthropicProvider in this same
 * directory. Gemini has no distinct "system" role - the system prompt is
 * passed via systemInstruction instead, and conversation turns use "model"
 * in place of "assistant".
 *
 * Model is configurable via the constructor / GEMINI_MODEL env var, not
 * hardcoded - verified live against the API's ListModels endpoint on
 * 2026-10-31: gemini-3.5-flash-lite exists and supports both
 * generateContent and streamGenerateContent. gemini-3.8-flash is the newest
 * flash model but was reported overloaded (503s) earlier the same day, so it
 * is deliberately not the default - swap GEMINI_MODEL if/when that settles.
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Speed-optimization config, verified live against this model on 2026-10-31:
 * - thinkingConfig.thinkingBudget: 0 is REJECTED (400) by gemini-3.5-flash-lite
 *   - this is a Gemini 3 family "always-thinks-some" model. thinkingLevel:
 *     "low" IS accepted and is the lowest level available, confirmed via a
 *     live curl call (usageMetadata.thoughtsTokenCount dropped to the
 *     minimum the model will do, it cannot be forced to exactly zero).
 * - maxOutputTokens caps response length for the fast/concise chat path so
 *   a verbose model doesn't pad latency with unrequested length; this value
 *   is generous enough for a normal multi-paragraph chat answer while still
 *   bounding worst-case generation time.
 */
const DEFAULT_GENERATION_CONFIG = {
  thinkingConfig: { thinkingLevel: 'low' as const },
  maxOutputTokens: 800,
};

/** Merges a per-call GenerationOptions (from the assistant's fast/deep mode
 * split) over the default config - callers that pass nothing get the
 * existing fast-path defaults unchanged. */
function resolveGenerationConfig(options?: GenerationOptions) {
  return {
    thinkingConfig: { thinkingLevel: options?.thinkingLevel ?? DEFAULT_GENERATION_CONFIG.thinkingConfig.thinkingLevel },
    maxOutputTokens: options?.maxOutputTokens ?? DEFAULT_GENERATION_CONFIG.maxOutputTokens,
  };
}

function toGeminiContents(messages: ChatMessage[]) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return { system, contents };
}

export class GeminiProvider implements AiProvider {
  constructor(
    private apiKey: string = process.env.GEMINI_API_KEY ?? '',
    private model: string = DEFAULT_MODEL
  ) {}

  async complete(messages: ChatMessage[], options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const { system, contents } = toGeminiContents(messages);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: resolveGenerationConfig(options),
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          }),
          signal: controller.signal,
        }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Gemini request timed out.');
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API error: ${res.status} ${body}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  /**
   * Streams via Gemini's streamGenerateContent?alt=sse endpoint. Each SSE
   * frame is a complete JSON object prefixed with "data: " on its own line,
   * separated by blank lines - verified live with curl on 2026-10-31. We
   * read the fetch response body as a Node readable stream, buffer partial
   * lines, and parse each complete "data: {...}" frame independently
   * (frames are NOT guaranteed to align with chunk boundaries).
   */
  async streamComplete(messages: ChatMessage[], onChunk: (text: string) => void, options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const { system, contents } = toGeminiContents(messages);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: resolveGenerationConfig(options),
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          }),
          signal: controller.signal,
        }
      );
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === 'AbortError') throw new Error('Gemini stream request timed out.');
      throw err;
    }

    if (!res.ok) {
      clearTimeout(timeout);
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API error: ${res.status} ${body}`);
    }

    if (!res.body) {
      clearTimeout(timeout);
      throw new Error('Gemini streaming response had no body.');
    }

    let full = '';
    let buffer = '';
    const reader = (res.body as any).getReader
      ? (res.body as ReadableStream<Uint8Array>).getReader()
      : null;

    try {
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          full = this.drainSseBuffer(buffer, onChunk, (rest) => { buffer = rest; }, full);
        }
      } else {
        // Node fetch (undici) response bodies are async-iterable.
        for await (const chunk of res.body as any) {
          buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
          full = this.drainSseBuffer(buffer, onChunk, (rest) => { buffer = rest; }, full);
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!full) {
      throw new Error('Gemini stream produced no content.');
    }
    return full;
  }

  /** Parses complete "data: {...}" SSE frames out of buffer, emits chunk
   * text via onChunk, and reports back the leftover partial buffer. */
  private drainSseBuffer(
    buffer: string,
    onChunk: (text: string) => void,
    setRemainder: (rest: string) => void,
    fullSoFar: string
  ): string {
    const lines = buffer.split('\n');
    const remainder = lines.pop() ?? '';
    let full = fullSoFar;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const parsed = JSON.parse(jsonStr) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (text) {
          full += text;
          onChunk(text);
        }
      } catch {
        // Malformed/partial frame - skip rather than crash the stream.
      }
    }
    setRemainder(remainder);
    return full;
  }
}
