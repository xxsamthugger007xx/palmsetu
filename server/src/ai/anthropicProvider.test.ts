import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnthropicProvider, toAnthropicPayload } from './anthropicProvider';

afterEach(() => vi.restoreAllMocks());

const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const sse = (events: object[]) => new Response(events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join(''), { status: 200 });

describe('toAnthropicPayload', () => {
  it('joins system messages, keeps turns, and guarantees a leading user turn', () => {
    const p = toAnthropicPayload([
      { role: 'system', content: 'A' }, { role: 'system', content: 'B' },
      { role: 'assistant', content: 'hi' }, { role: 'user', content: 'q' },
    ]);
    expect(p.system).toBe('A\n\nB');
    expect(p.messages[0].role).toBe('user');
    expect(p.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });
});

describe('AnthropicProvider', () => {
  it('requires a key', async () => {
    await expect(new AnthropicProvider('').complete([{ role: 'user', content: 'x' }])).rejects.toThrow(/not configured/);
  });

  it('sends Haiku 5.5 with thinking headroom + effort, returns text blocks only, reports real usage', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }],
      stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 250 },
    }));
    const onUsage = vi.fn();
    const out = await new AnthropicProvider('k').complete(
      [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }],
      { maxOutputTokens: 800, thinkingLevel: 'medium', onUsage }
    );
    expect(out).toBe('Hello world');
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 100, outputTokens: 250 });
    const body = JSON.parse((spy.mock.calls[0][1] as any).body);
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 2300, system: 'sys', output_config: { effort: 'medium' } });
    expect(body.temperature).toBeUndefined();
    expect((spy.mock.calls[0][1] as any).headers['x-api-key']).toBe('k');
  });

  it('surfaces API errors and refusals', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ error: 'bad' }, 400));
    await expect(new AnthropicProvider('k').complete([{ role: 'user', content: 'x' }])).rejects.toThrow(/400/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ content: [], stop_reason: 'refusal' }));
    await expect(new AnthropicProvider('k').complete([{ role: 'user', content: 'x' }])).rejects.toThrow(/declined/);
  });

  it('streams text deltas and reports cumulative usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([
      { type: 'message_start', message: { usage: { input_tokens: 120, output_tokens: 1 } } },
      { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 300 } },
      { type: 'message_stop' },
    ]));
    const chunks: string[] = []; const onUsage = vi.fn();
    const full = await new AnthropicProvider('k').streamComplete([{ role: 'user', content: 'hi' }], (c) => chunks.push(c), { onUsage });
    expect(chunks).toEqual(['Hel', 'lo']);
    expect(full).toBe('Hello');
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 120, outputTokens: 300 });
  });

  it('throws on a mid-stream error event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([{ type: 'error', error: { message: 'overloaded' } }]));
    await expect(new AnthropicProvider('k').streamComplete([{ role: 'user', content: 'x' }], () => {})).rejects.toThrow(/overloaded/);
  });
});
