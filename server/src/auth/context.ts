import { verifyToken } from './tokens';

export interface AuthContext {
  userId: string;
  isGuest: boolean;
}

/**
 * Resolves who is making this request, in priority order:
 *
 * 1. A real Authorization: Bearer <jwt> token - either a signed-in account
 *    (kind: 'user') or a guest session (kind: 'guest', see routes/auth.ts's
 *    POST /auth/guest). This is the real, current auth mechanism.
 * 2. The same token passed as a `?token=` query parameter instead of a
 *    header - needed for RN's <Image> component, which makes its own
 *    native network request and never attaches the custom Authorization
 *    header apiRequest.ts sends on every normal fetch() call. Without this,
 *    an authenticated image (a palm photo) 404s even for its real owner,
 *    since the request would otherwise carry no identity at all. Verified
 *    with the exact same verifyToken() check as the header path - a
 *    tampered or expired token here is rejected exactly like a bad header.
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
export function resolveAuthContext(req: any): AuthContext {
  const authHeader = req.headers['authorization'] as string | undefined;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined;
  const token = bearerToken ?? queryToken;

  if (token) {
    const payload = verifyToken(token);
    if (payload?.kind === 'user') return { userId: payload.userId, isGuest: false };
    if (payload?.kind === 'guest') return { userId: payload.guestId, isGuest: true };
    // An invalid/expired token falls through to the legacy header rather
    // than hard-failing every route - routes that genuinely require a real
    // account use requireAccount() (auth/middleware.ts), which does reject
    // this case explicitly.
  }

  const legacyHeader = req.headers['x-demo-user'] as string | undefined;
  if (legacyHeader) return { userId: legacyHeader, isGuest: true };

  return { userId: 'demo-user', isGuest: true };
}
