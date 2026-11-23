import { verifyToken } from './tokens';
import { accountsById, revokedTokens } from '../data/store';

export interface AuthContext {
  userId: string;
  isGuest: boolean;
  /** JWT id / expiry (unix seconds) of the token this request used - lets logout revoke exactly this session. */
  jti?: string;
  exp?: number;
  /** A token WAS presented but is no longer valid (expired, tampered, revoked, account deleted, password reset).
   * attachAuthContext answers such requests with 401 SESSION_INVALID instead of silently treating them as anonymous. */
  invalidSession?: boolean;
}

/**
 * Resolves who is making this request, in priority order:
 *
 * 1. A real Authorization: Bearer <jwt> token - either a signed-in account
 *    (kind: 'user') or a guest session (kind: 'guest', see routes/auth.ts's
 *    POST /auth/guest). This is the real, current auth mechanism.
 * 2. (Removed) The session token is no longer accepted in a `?token=` query string - it leaked long-lived
 *    credentials into URLs and logs. Palm photos use short-lived signed URLs instead (auth/signedUrl.ts).
 * 3. The legacy x-demo-user header every route file used before real auth
 *    existed. Kept as a fallback (not removed) so the existing test suite
 *    and any in-progress manual testing that still sets this header keep
 *    working exactly as before - treated as an (unverified) guest.
 * 4. The literal string 'demo-user', the same hardcoded default every route
 *    already used.
 *
 * Nothing here trusts a client-supplied userId/guestId beyond what the JWT
 * itself was signed for - a request cannot claim to be a different account
 * by sending a different header value once a real token is required by a
 * route (see auth/middleware.ts's requireAccount).
 */
/** Anything with request headers (and optionally a query), so unit tests can pass plain objects. */
type AuthRequestLike = { headers: { [key: string]: string | string[] | undefined }; query?: unknown };

export function resolveAuthContext(req: AuthRequestLike): AuthContext {
  const authHeader = req.headers['authorization'] as string | undefined;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined;
  const token = bearerToken;

  if (token) {
    const payload = verifyToken(token);
    const bad: AuthContext = { userId: 'demo-user', isGuest: true, invalidSession: true };
    if (!payload) return bad;
    if (payload.jti && revokedTokens.has(payload.jti)) return bad;
    if (payload.kind === 'user') {
      const account = accountsById.get(payload.userId);
      // Deleted account, or a password reset since this token was issued: the session is over.
      if (!account || (account.tokenVersion ?? 0) !== (payload.tv ?? 0)) return bad;
      return { userId: payload.userId, isGuest: false, jti: payload.jti, exp: payload.exp };
    }
    if (payload.kind === 'guest') return { userId: payload.guestId, isGuest: true, jti: payload.jti, exp: payload.exp };
    return bad;
  }

  // The legacy header lets ANY caller claim ANY user id with no credentials (read/modify
  // their data, dodge per-user quotas and rate limits by rotating values), so it is only
  // honored under the test runner or when explicitly opted into for local debugging.
  const legacyHeader = req.headers['x-demo-user'] as string | undefined;
  const demoHeaderAllowed = process.env.NODE_ENV === 'test' || process.env.ALLOW_DEMO_USER_HEADER === 'true';
  if (legacyHeader && demoHeaderAllowed) return { userId: legacyHeader, isGuest: true };

  return { userId: 'demo-user', isGuest: true };
}
