/**
 * Shared fetch wrapper for every *Api.ts service file. The one thing this
 * centralizes: telling apart a request that never reached the server (the
 * phone's fetch() throwing before any response exists - wrong IP, server
 * down, no network) from a request that reached the server and got a real
 * error response (4xx/5xx with a JSON error body, e.g. "Lagna/houses
 * require a birth time"). Screens need to treat these very differently -
 * the first should show a generic "check your connection" message with a
 * Retry button, the second should show the server's actual message - so
 * every thrown error here carries an `isNetworkError` flag screens can
 * branch on instead of dumping err.message straight into the UI.
 */
import i18n from '../i18n';
export interface ApiError extends Error {
  status?: number;
  code?: string;
  isNetworkError: boolean;
  /** Extra fields some endpoints attach (palm photo validation details, purchase cancellation, ...). */
  [extra: string]: any;
}

/** Narrow a caught value to an ApiError so screens can read .status/.code/.isNetworkError without `any`. Anything that
 * isn't an Error (e.g. a thrown string) is wrapped, so .message is always a string. */
export function asApiError(e: unknown): ApiError {
  if (e instanceof Error) return e as ApiError;
  const wrapped = new Error(typeof e === 'string' ? e : 'Unknown error') as ApiError;
  wrapped.isNetworkError = false;
  return wrapped;
}

// Set by AuthContext whenever the current session token (real account or
// guest) changes - a plain module-level mutable rather than a React hook
// because this file is called from plain functions (the *Api.ts service
// files), not components. Read fresh on every request, never cached past a
// single call, so a token refresh/logout takes effect on the very next
// request with no extra wiring needed at each call site.
let currentAuthToken: string | null = null;

// Set by AuthContext: called when the server says the stored session is dead (expired, signed out elsewhere, account
// deleted, password reset). It swaps in a fresh guest session so the app keeps working instead of showing errors.
let sessionInvalidHandler: (() => void | Promise<void>) | null = null;
export function setSessionInvalidHandler(fn: (() => void | Promise<void>) | null): void {
  sessionInvalidHandler = fn;
}

export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
}

/** For the rare case a screen needs to attach the auth token itself - e.g.
 * RN's <Image> component makes its own native network request and never
 * goes through request() above, so it never gets the Authorization header
 * this file attaches to every JSON call. Screens displaying an
 * authenticated image (palm photos) read this to build
 * source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
 * themselves - without it, the image request resolves server-side to the
 * anonymous fallback identity and gets a 404 even though the real session
 * genuinely owns the image. */
export function getAuthToken(): string | null {
  return currentAuthToken;
}

/** The device's own calendar date (YYYY-MM-DD). Sent on every request so the server knows the user's "today" instead
 * of assuming UTC - otherwise streaks and "done today" flip at the wrong hour for anyone far from UTC. */
export function deviceLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Looked up when an error is created (not at import time) so they follow the user's chosen language.
export const networkErrorMessage = () => i18n.t('errors.network') as string;
export const timeoutErrorMessage = () => i18n.t('errors.timeout') as string;
// Server errors the app has its own translated wording for, by error code (the server always answers in English).
const TRANSLATED_ERROR_CODES: Record<string, string> = {
  AI_BUDGET_EXCEEDED: 'errors.aiLimit',
  SESSION_INVALID: 'errors.sessionExpired',
  RATE_LIMITED: 'errors.rateLimited',
};

// No fetch() call in this app had a timeout before this - a stalled
// connection (flaky wifi, a server that accepted the TCP connection but
// never responded) would hang a loading spinner forever with no error ever
// surfacing, since fetch() only rejects on an outright connection failure,
// not a stall. Every request gets a hard ceiling so a screen can never be
// stuck indefinitely on "Loading...".
const REQUEST_TIMEOUT_MS = 15_000;

function makeNetworkError(cause: unknown): ApiError {
  const error = new Error(networkErrorMessage()) as ApiError;
  error.isNetworkError = true;
  if (cause instanceof Error && cause.message) {
    // Keep the raw cause out of the user-facing message, but preserve it
    // for logging/debugging (e.g. console.warn at the call site).
    (error as any).cause = cause;
  }
  return error;
}

function makeTimeoutError(): ApiError {
  const error = new Error(timeoutErrorMessage()) as ApiError;
  error.isNetworkError = true;
  return error;
}

export async function request<T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Local-Date': deviceLocalDate(),
        ...(currentAuthToken ? { Authorization: `Bearer ${currentAuthToken}` } : {}),
      },
      ...options,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw makeTimeoutError();
    // fetch() throwing (not resolving with a Response) means the request
    // never reached the server at all - RN's "Network request failed" /
    // "fetch failed: Could not connect to the server" cases. This is the
    // exact bug reported on the birth-details screen: that raw error text
    // was surfacing directly in the UI instead of a friendly message.
    throw makeNetworkError(err);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && body.code === 'SESSION_INVALID' && currentAuthToken && sessionInvalidHandler) {
      void sessionInvalidHandler();
    }
    const translated = body.code && TRANSLATED_ERROR_CODES[body.code] ? (i18n.t(TRANSLATED_ERROR_CODES[body.code]) as string) : null;
    const error = new Error(translated ?? body.error ?? `Request failed: ${res.status}`) as ApiError;
    error.status = res.status;
    error.code = body.code;
    error.isNetworkError = false;
    // Some endpoints (e.g. palm readings) attach extra diagnostic fields
    // beyond error/code (validationStatus, imageQuality) that screens
    // already read off the caught error - preserve those too.
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'error' && key !== 'code') (error as any)[key] = value;
    }
    throw error;
  }
  return res.json() as Promise<T>;
}
