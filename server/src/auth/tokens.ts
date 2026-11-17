import jwt from 'jsonwebtoken';

/**
 * JWT session tokens for both real accounts and guest sessions. Both are the
 * same token shape (see AuthTokenPayload) distinguished by `kind`, so a
 * single Authorization: Bearer <token> header and a single verify() call
 * handles either case - routes/middleware never need to branch on how the
 * caller authenticated, only on whether `kind === 'guest'`.
 *
 * JWT_SECRET has no safe production default. An insecure, clearly-labeled
 * fallback is used only so this app keeps working in local development
 * without requiring every contributor to generate a secret first - this
 * must be overridden by a real secret before any real deployment.
 */

const INSECURE_DEV_SECRET = 'solune-dev-insecure-secret-do-not-use-in-production';
let warnedInsecureSecret = false;

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (!warnedInsecureSecret) {
      console.warn('[auth/tokens] JWT_SECRET is not set - using an insecure development default. Set a real random secret before deploying.');
      warnedInsecureSecret = true;
    }
    return INSECURE_DEV_SECRET;
  }
  return secret;
}

export type AuthTokenPayload =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; guestId: string };

// Guest sessions and real account sessions both get a generous expiry - this
// app has no refresh-token rotation, so the token itself is the session.
// Guests get a shorter lifetime since their data has its own retention
// policy (see auth/guestMigration.ts) and nothing valuable is lost if a
// guest session quietly expires and a new one is created.
const USER_TOKEN_TTL = '30d';
const GUEST_TOKEN_TTL = '14d';

export function signUserToken(userId: string): string {
  return jwt.sign({ kind: 'user', userId } satisfies AuthTokenPayload, getSecret(), { expiresIn: USER_TOKEN_TTL });
}

export function signGuestToken(guestId: string): string {
  return jwt.sign({ kind: 'guest', guestId } satisfies AuthTokenPayload, getSecret(), { expiresIn: GUEST_TOKEN_TTL });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === 'object' && decoded && 'kind' in decoded) {
      return decoded as AuthTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}
