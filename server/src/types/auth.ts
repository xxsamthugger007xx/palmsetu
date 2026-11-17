/** Real, authenticated Palm Setu account - distinct from UserIdentity
 * (display name/gender) and BirthProfile (astrology birth details) in
 * types/astrology.ts, which remain separate per-userId records exactly as
 * they were before auth existed. This is the credential/identity record:
 * what proves who is signing in, not what they've told the app about
 * themselves. */
export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One guest session, created the first time someone opens the app without
 * signing in. `migratedAt`/`migratedToUserId` are set once, the first time
 * this guest successfully registers or logs in with an existing account -
 * after that the session is inert (see auth/guestMigration.ts), its data
 * already reassigned to the real account. */
export interface GuestSession {
  id: string;
  createdAt: string;
  migratedAt: string | null;
  migratedToUserId: string | null;
}

/** Login/signup attempt counter for basic rate limiting, keyed by
 * `${ip}:${email}`. windowStart resets the count once RATE_LIMIT_WINDOW_MS
 * has elapsed (see auth/rateLimit.ts) - this is a simple fixed-window
 * limiter, not a sliding-window one, which is an accepted tradeoff for an
 * app this size. */
export interface AuthAttemptRecord {
  key: string;
  count: number;
  windowStart: string;
}
