import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import {
  accountsById, findAccountByEmail, createGuestSession, guestSessionsById,
  readingsById, tarotReadingsById, kundliChartsById, gemstoneReportsById, vastuReportsById, vastuPropertiesById,
  birthProfiles, userIdentities, userPlans,
} from '../data/store';
import { Account } from '../types/auth';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { signUserToken, signGuestToken, verifyToken } from '../auth/tokens';
import { verifyTurnstileToken } from '../auth/turnstile';
import { checkAuthRateLimit, recordAuthAttempt, clearAuthAttempts } from '../auth/rateLimit';
import { migrateGuestDataToAccount } from '../auth/guestMigration';
import { requireAccount } from '../auth/middleware';
import { sendVerificationEmail, consumeVerificationToken } from '../auth/emailVerification';
import { deleteReadingImage } from '../palmistry/imageStorage';
import { getOrCreatePsuId } from '../auth/psuId';
import { recordEvent } from '../events/eventTracker';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  turnstileToken: z.string().optional(),
});

function clientIp(req: any): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function accountPublicShape(account: Account) {
  return { id: account.id, email: account.email, emailVerified: account.emailVerified, createdAt: account.createdAt };
}

/** If this request carried a guest session token, migrate that guest's
 * data into the account that just signed up/logged in. Safe to call even
 * when the caller was not actually a guest (req.auth.isGuest with the
 * literal legacy 'demo-user'/x-demo-user fallback) - migrateGuestDataToAccount
 * is a no-op when there's nothing to move, and guestId === userId is
 * explicitly short-circuited there too. */
function migrateIfGuest(req: any, newUserId: string) {
  if (req.auth?.isGuest && req.auth.userId && req.auth.userId !== newUserId) {
    try {
      migrateGuestDataToAccount(req.auth.userId, newUserId);
    } catch (err) {
      // Never let a migration failure block a successful signup/login - the
      // guest data is untouched (migrateGuestDataToAccount only reassigns
      // records it successfully processes, see its own doc comment), so
      // this is safely retryable via POST /auth/migrate-guest.
      console.warn('[auth] guest data migration failed, guest data left untouched:', err);
    }
  }
}

export function buildAuthRouter() {
  const router = Router();

  // New guest session - called once per fresh install/browser, before any
  // sign-in. The resulting token is what every other route's
  // resolveAuthContext() accepts as an (unverified) guest identity.
  router.post('/guest', (req, res) => {
    const guestId = `guest-${uuid()}`;
    createGuestSession(guestId);
    res.json({ token: signGuestToken(guestId), guestId });
  });

  router.post('/signup', async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' });
    const { email, password, turnstileToken } = parsed.data;
    const ip = clientIp(req);

    if (!checkAuthRateLimit(ip, email)) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
    }
    recordAuthAttempt(ip, email);

    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) {
      return res.status(400).json({ error: 'Verification failed - please retry.', code: 'TURNSTILE_FAILED' });
    }

    if (findAccountByEmail(email)) {
      // Deliberately generic message (not "email already exists") to avoid
      // trivially confirming which emails are registered - but the code is
      // still distinct so the frontend can route to the login form.
      return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_TAKEN' });
    }

    const now = new Date().toISOString();
    const account: Account = {
      id: `user-${uuid()}`,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
    accountsById.set(account.id, account);
    getOrCreatePsuId(account.id);
    clearAuthAttempts(ip, email);

    migrateIfGuest(req, account.id);
    recordEvent({ userId: account.id, eventType: 'USER_REGISTERED', feature: 'auth' });
    sendVerificationEmail(account.id, account.email).catch((err) =>
      console.warn('[auth] verification email failed to send:', err));

    res.json({ token: signUserToken(account.id), account: accountPublicShape(account) });
  });

  router.post('/login', async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input', code: 'INVALID_INPUT' });
    const { email, password, turnstileToken } = parsed.data;
    const ip = clientIp(req);

    if (!checkAuthRateLimit(ip, email)) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
    }
    recordAuthAttempt(ip, email);

    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) {
      return res.status(400).json({ error: 'Verification failed - please retry.', code: 'TURNSTILE_FAILED' });
    }

    const account = findAccountByEmail(email);
    // Same generic message whether the email doesn't exist or the password
    // is wrong - avoids leaking which emails have accounts.
    const invalid = () => res.status(401).json({ error: 'Incorrect email or password.', code: 'INVALID_CREDENTIALS' });
    if (!account) return invalid();

    const passwordOk = await verifyPassword(password, account.passwordHash);
    if (!passwordOk) return invalid();

    clearAuthAttempts(ip, email);
    migrateIfGuest(req, account.id);
    recordEvent({ userId: account.id, eventType: 'USER_LOGIN', feature: 'auth' });

    res.json({ token: signUserToken(account.id), account: accountPublicShape(account) });
  });

  // Explicit retry endpoint for a migration that may have failed silently
  // during signup/login (see migrateIfGuest's catch) - requires the caller
  // to already be signed in as the destination account, and still takes the
  // guest token from the Authorization header the same way, so a guest
  // session can only ever be migrated by someone who can present its token.
  router.post('/migrate-guest', requireAccount, (req, res) => {
    const guestToken = req.body?.guestToken as string | undefined;
    if (!guestToken) return res.status(400).json({ error: 'guestToken is required', code: 'INVALID_INPUT' });

    const payload = verifyToken(guestToken);
    if (!payload || payload.kind !== 'guest') {
      return res.status(400).json({ error: 'Invalid or expired guest session', code: 'INVALID_GUEST_TOKEN' });
    }

    const result = migrateGuestDataToAccount(payload.guestId, req.auth!.userId);
    res.json(result);
  });

  // Link target from the verification email - GET since it is opened
  // straight from an email client, not called by the app. Renders a small
  // standalone HTML page (no app deep-link wiring exists yet) telling the
  // user to go back to the app.
  router.get('/verify-email', (req, res) => {
    const token = req.query.token as string | undefined;
    const accountId = token ? consumeVerificationToken(token) : null;
    const account = accountId ? accountsById.get(accountId) : null;

    if (account) {
      accountsById.set(account.id, { ...account, emailVerified: true, updatedAt: new Date().toISOString() });
    }

    const ok = !!account;
    res.status(ok ? 200 : 400).send(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${ok ? 'Email verified' : 'Verification link invalid'}</title>
          <style>
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #161826; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { text-align: center; max-width: 360px; padding: 32px; }
            h1 { color: ${ok ? '#9184d9' : '#e06666'}; font-size: 22px; }
            p { color: #cfcfdb; font-size: 15px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${ok ? 'Email verified' : 'This link is invalid or has expired'}</h1>
            <p>${ok ? 'You can return to the Palm Setu app now.' : 'Open the app and request a new verification email from your account settings.'}</p>
          </div>
        </body>
      </html>
    `);
  });

  // Lets a signed-in account request a fresh link, e.g. the first one
  // expired or landed in spam - always a generic success response, same
  // reasoning as the signup EMAIL_TAKEN message, so this can't be used to
  // probe whether a given account exists.
  router.post('/resend-verification', requireAccount, async (req, res) => {
    const account = accountsById.get(req.auth!.userId);
    if (account && !account.emailVerified) {
      await sendVerificationEmail(account.id, account.email).catch((err) =>
        console.warn('[auth] resend verification email failed:', err));
    }
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    const auth = req.auth!;
    if (auth.isGuest) {
      return res.json({ isGuest: true, userId: auth.userId });
    }
    const account = accountsById.get(auth.userId);
    if (!account) return res.status(404).json({ error: 'Account not found', code: 'NOT_FOUND' });
    res.json({ isGuest: false, account: accountPublicShape(account) });
  });

  // Stateless JWTs: there is no server-side session to invalidate, so this
  // is a no-op that exists for API symmetry and so a future server-side
  // token blacklist (if ever needed) has an obvious place to live.
  router.post('/logout', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/export', requireAccount, (req, res) => {
    const userId = req.auth!.userId;
    res.json({
      account: accountPublicShape(accountsById.get(userId)!),
      birthProfile: birthProfiles.get(userId) ?? null,
      identity: userIdentities.get(userId) ?? null,
      palmReadings: [...readingsById.values()].filter((r) => r.userId === userId),
      tarotReadings: [...tarotReadingsById.values()].filter((r) => r.userId === userId),
      kundliCharts: [...kundliChartsById.values()].filter((r) => r.userId === userId),
      gemstoneReports: [...gemstoneReportsById.values()].filter((r) => r.userId === userId),
      vastuReports: [...vastuReportsById.values()].filter((r) => r.userId === userId),
    });
  });

  router.delete('/account', requireAccount, (req, res) => {
    const userId = req.auth!.userId;

    for (const r of [...readingsById.values()].filter((r) => r.userId === userId)) {
      deleteReadingImage(r.id);
      readingsById.delete(r.id);
    }
    for (const r of [...tarotReadingsById.values()].filter((r) => r.userId === userId)) tarotReadingsById.delete(r.id);
    for (const r of [...kundliChartsById.values()].filter((r) => r.userId === userId)) kundliChartsById.delete(r.id);
    for (const r of [...gemstoneReportsById.values()].filter((r) => r.userId === userId)) gemstoneReportsById.delete(r.id);
    for (const r of [...vastuReportsById.values()].filter((r) => r.userId === userId)) vastuReportsById.delete(r.id);
    for (const r of [...vastuPropertiesById.values()].filter((r) => r.userId === userId)) vastuPropertiesById.delete(r.id);
    birthProfiles.delete(userId);
    userIdentities.delete(userId);
    userPlans.delete(userId);
    accountsById.delete(userId);

    res.json({ ok: true });
  });

  return router;
}
