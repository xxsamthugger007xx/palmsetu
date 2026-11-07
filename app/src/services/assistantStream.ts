import { assistantApi, SendMessageResponse } from './assistantApi';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface StageEvent {
  key: string;
  label: string;
}

export interface StreamHandlers {
  onStage?: (stage: StageEvent) => void;
  onChunk?: (text: string) => void;
  onDone?: (result: SendMessageResponse) => void;
  onError?: (message: string) => void;
}

export interface StreamHandle {
  abort: () => void;
}

/**
 * Streams POST /assistant/message/stream using XMLHttpRequest, since React
 * Native's fetch does not reliably expose a readable response body across
 * RN/Expo versions (no consistent response.body.getReader() support). XHR's
 * responseText DOES grow incrementally as chunks arrive in RN, which is the
 * standard workaround - onprogress reads only the newly-arrived slice since
 * the last cursor position, splits on newlines, and parses each complete
 * line as NDJSON, buffering any trailing partial line until the next tick.
 *
 * Falls back to the existing non-streaming assistantApi.sendMessage() if the
 * stream errors out before producing any chunks, or produces zero chunks at
 * all before completing/erroring - so the feature never just breaks.
 */
export function streamAssistantMessage(
  conversationId: string | null,
  message: string,
  screenContext: string | null | undefined,
  handlers: StreamHandlers,
): StreamHandle {
  const xhr = new XMLHttpRequest();
  let cursor = 0;
  let buffer = '';
  let receivedAnyChunk = false;
  let settled = false;
  let aborted = false;

  const fallback = () => {
    if (settled || aborted) return;
    settled = true;
    assistantApi
      .sendMessage(conversationId, message, screenContext)
      .then((res) => handlers.onDone?.(res))
      .catch((err) => handlers.onError?.(err?.message ?? 'Something went wrong. Please try again.'));
  };

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let obj: any;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return; // malformed line - skip rather than crash the stream
    }
    if (obj.type === 'stage') {
      handlers.onStage?.({ key: obj.key, label: obj.label });
    } else if (obj.type === 'chunk') {
      receivedAnyChunk = true;
      if (obj.text) handlers.onChunk?.(obj.text);
    } else if (obj.type === 'done') {
      settled = true;
      handlers.onDone?.({
        conversationId: obj.conversationId,
        // The caller prefers its own accumulated chunk text when it has any
        // (so a genuinely streamed answer doesn't flash/replace itself), but
        // several pipeline paths never stream a single chunk (unknown
        // feature, no data on file, crisis response, etc) - obj.reply is the
        // real server-computed answer for those cases and must not be
        // dropped, or the chat bubble renders permanently empty.
        reply: obj.reply ?? '',
        premiumCard: obj.premiumCard ?? null,
        suggestedFollowUps: obj.suggestedFollowUps ?? [],
        detectedFeature: obj.detectedFeature ?? null,
      });
    } else if (obj.type === 'error') {
      if (receivedAnyChunk) {
        settled = true;
        handlers.onError?.(obj.message ?? 'Something went wrong. Please try again.');
      } else {
        fallback();
      }
    }
  };

  const drain = () => {
    const newText = xhr.responseText.slice(cursor);
    cursor = xhr.responseText.length;
    buffer += newText;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  };

  xhr.open('POST', `${BASE_URL}/assistant/message/stream`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 30_000;

  xhr.onprogress = drain;

  xhr.onload = () => {
    drain();
    if (buffer.trim()) handleLine(buffer);
    if (!settled) {
      // Stream ended without a "done"/"error" line - if we got real content,
      // treat it as a soft success (nothing more to show); otherwise fall
      // back to the non-streaming endpoint.
      if (receivedAnyChunk) {
        settled = true;
      } else {
        fallback();
      }
    }
  };

  xhr.onerror = () => fallback();
  xhr.ontimeout = () => fallback();
  xhr.onabort = () => {
    aborted = true;
  };

  xhr.send(JSON.stringify({ conversationId, message, screenContext: screenContext ?? null }));

  return {
    abort: () => {
      aborted = true;
      xhr.abort();
    },
  };
}
