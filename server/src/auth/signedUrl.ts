import crypto from 'crypto';
import { getSecret } from './tokens';

/**
 * Short-lived signed URLs for resources an <Image> must fetch without custom headers (stored palm photos).
 * Replaces putting the long-lived session JWT in a ?token= query string, which leaks through logs, proxies,
 * screenshots and shared links. A signed URL grants read access to ONE path for a few minutes and nothing else.
 */
const DEFAULT_TTL_SECONDS = 600;

function mac(path: string, exp: number): string {
  return crypto.createHmac('sha256', `${getSecret()}:signed-url`).update(`${path}|${exp}`).digest('hex');
}

export function signPath(path: string, ttlSeconds = DEFAULT_TTL_SECONDS): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp, sig: mac(path, exp) };
}

export function verifySignedPath(path: string, expRaw: unknown, sigRaw: unknown): boolean {
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || typeof sigRaw !== 'string' || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(mac(path, exp), 'hex');
  let given: Buffer;
  try { given = Buffer.from(sigRaw, 'hex'); } catch { return false; }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
