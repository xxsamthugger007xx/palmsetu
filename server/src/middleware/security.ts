import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { CorsOptions } from 'cors';

/**
 * CORS: native apps send no Origin header, so they are unaffected. Browsers
 * (the admin panel is same-origin, so it is also unaffected) are only allowed
 * from origins listed in CORS_ORIGINS (comma-separated). In development with
 * nothing configured every origin is allowed (Expo web); in production with
 * nothing configured, cross-origin browser access is denied.
 */
export function buildCorsOptions(): CorsOptions {
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.length === 0) {
    return { origin: process.env.NODE_ENV !== 'production' };
  }
  return { origin: allowed };
}

type Bucket = { count: number; resetAt: number };

/** Small in-memory fixed-window limiter (no extra dependency). Keyed by
 * authenticated user/guest when known, otherwise by IP. State resets on
 * restart, which is acceptable for a single-process deployment. */
export function rateLimit(opts: { windowMs: number; max: number; name: string }): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, opts.windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const auth: any = req.auth;
    const who = auth?.userId ?? auth?.guestId ?? req.ip ?? 'unknown';
    const key = `${opts.name}:${who}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.', code: 'RATE_LIMITED' });
    }
    next();
  };
}
