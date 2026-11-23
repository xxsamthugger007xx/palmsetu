/** Anything with request headers (Express Request, or a plain object in tests). */
export type HeaderCarrier = { headers: { [key: string]: string | string[] | undefined } };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * The caller's own calendar date ("today" for them), from the X-Local-Date header the app sends on every request.
 * The server's clock is UTC, so for users far from UTC "today" was wrong for hours every day (a user in India at
 * 1 AM was still on yesterday's streak/journal day). The header is only trusted when it is a real date within one
 * day of the server's UTC date - every real timezone is within that - otherwise this falls back to UTC, so a bad or
 * forged header can't be used to jump days.
 */
export function requestLocalDate(req: HeaderCarrier, now: Date = new Date()): string {
  const utcToday = now.toISOString().slice(0, 10);
  const raw = req.headers['x-local-date'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !DATE.test(value)) return utcToday;
  const t = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== value) return utcToday;
  const diff = Math.abs(t - Date.parse(`${utcToday}T00:00:00Z`));
  return diff <= DAY_MS ? value : utcToday;
}
