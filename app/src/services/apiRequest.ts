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
export interface ApiError extends Error {
  status?: number;
  code?: string;
  isNetworkError: boolean;
}

export const NETWORK_ERROR_MESSAGE = 'Unable to connect. Check your connection and try again.';
export const TIMEOUT_ERROR_MESSAGE = 'This is taking too long. Check your connection and try again.';

// No fetch() call in this app had a timeout before this - a stalled
// connection (flaky wifi, a server that accepted the TCP connection but
// never responded) would hang a loading spinner forever with no error ever
// surfacing, since fetch() only rejects on an outright connection failure,
// not a stall. Every request gets a hard ceiling so a screen can never be
// stuck indefinitely on "Loading...".
const REQUEST_TIMEOUT_MS = 15_000;

function makeNetworkError(cause: unknown): ApiError {
  const error = new Error(NETWORK_ERROR_MESSAGE) as ApiError;
  error.isNetworkError = true;
  if (cause instanceof Error && cause.message) {
    // Keep the raw cause out of the user-facing message, but preserve it
    // for logging/debugging (e.g. console.warn at the call site).
    (error as any).cause = cause;
  }
  return error;
}

function makeTimeoutError(): ApiError {
  const error = new Error(TIMEOUT_ERROR_MESSAGE) as ApiError;
  error.isNetworkError = true;
  return error;
}

export async function request<T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
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
    const error = new Error(body.error ?? `Request failed: ${res.status}`) as ApiError;
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
