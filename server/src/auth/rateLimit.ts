import { authAttempts } from '../data/store';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

/** Simple fixed-window rate limiter for login/signup attempts, keyed by
 * `${ip}:${email}` so it limits both "many guesses against one account"
 * and "many accounts from one source" without needing a separate counter
 * for each. Returns false (and does NOT increment) once the window's
 * attempts are exhausted - call recordAuthAttempt() only for attempts that
 * actually reach password/Turnstile verification, not for malformed
 * requests, so this can't be trivially exhausted by garbage input alone. */
export function checkAuthRateLimit(ip: string, email: string): boolean {
  const key = `${ip}:${email.trim().toLowerCase()}`;
  const record = authAttempts.get(key);
  if (!record) return true;

  const windowAge = Date.now() - new Date(record.windowStart).getTime();
  if (windowAge > WINDOW_MS) return true;

  return record.count < MAX_ATTEMPTS;
}

export function recordAuthAttempt(ip: string, email: string): void {
  const key = `${ip}:${email.trim().toLowerCase()}`;
  const record = authAttempts.get(key);
  const windowAge = record ? Date.now() - new Date(record.windowStart).getTime() : Infinity;

  if (!record || windowAge > WINDOW_MS) {
    authAttempts.set(key, { key, count: 1, windowStart: new Date().toISOString() });
  } else {
    authAttempts.set(key, { ...record, count: record.count + 1 });
  }
}

export function clearAuthAttempts(ip: string, email: string): void {
  authAttempts.delete(`${ip}:${email.trim().toLowerCase()}`);
}
