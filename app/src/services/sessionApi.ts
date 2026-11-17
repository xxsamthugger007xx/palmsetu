import { request as baseRequest } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return baseRequest<T>(BASE_URL, path, options);
}

export interface StartSessionInput {
  device: string | null;
  os: string | null;
  appVersion: string | null;
  entryScreen: string | null;
}

export type SessionEventInput =
  | { type: 'screen_view'; screen: string }
  | { type: 'feature_used'; feature: string }
  | { type: 'action'; action: string }
  | { type: 'error'; error: string };

export const sessionApi = {
  start(input: StartSessionInput): Promise<{ sessionId: string; startedAt: string }> {
    return request('/app-session/start', { method: 'POST', body: JSON.stringify(input) });
  },
  // Fire-and-forget by design at the call site (sessionTracker.ts) - these
  // never block UI or get retried, since missing one beacon just means one
  // slightly less complete session record, never a user-facing failure.
  event(sessionId: string, event: SessionEventInput): Promise<{ ok: boolean }> {
    return request(`/app-session/${sessionId}/event`, { method: 'POST', body: JSON.stringify(event) });
  },
  end(sessionId: string, reason: 'background' | 'app_closed'): Promise<{ ok: boolean }> {
    return request(`/app-session/${sessionId}/end`, { method: 'POST', body: JSON.stringify({ reason }) });
  },
};
