import { Router, Request } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import {
  accountsById, findAccountByEmail, createGuestSession, guestSessionsById,
  revokedTokens,
} from '../data/store';
import { Account } from '../types/auth';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { signUserToken, signGuestToken, verifyToken } from '../auth/tokens';
import { verifyTurnstileToken } from '../auth/turnstile';
import { checkAuthRateLimit, recordAuthAttempt, clearAuthAttempts } from '../auth/rateLimit';
import { migrateGuestDataToAccount } from '../auth/guestMigration';
import { requireAccount } from '../auth/middleware';
import { requestPasswordReset, completePasswordReset } from '../auth/passwordReset';
import { reportError } from '../ops/alerts';
import { sendVerificationEmail, consumeVerificationToken } from '../auth/emailVerification';
import { deleteAllUserData, exportAllUserData } from '../auth/accountData';
import { getOrCreatePsuId } from '../auth/psuId';
import { recordEvent } from '../events/eventTracker';
import { verifyGoogleIdToken, googleConfigured, GoogleIdentity } from '../auth/googleVerify';
import { randomBytes } from 'crypto';
import { isFeatureEnabled } from '../data/featureFlags';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  turnstileToken: z.string().optional(),
});

function clientIp(req: Request): string {
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
function migrateIfGuest(req: Request, newUserId: string) {
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

export function buildAuthRouter(verifyGoogle: (idToken: string) => Promise<GoogleIdentity | null> = verifyGoogleIdToken) {
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

    res.json({ token: signUserToken(account.id, account.tokenVersion ?? 0), account: accountPublicShape(account) });
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

    res.json({ token: signUserToken(account.id, account.tokenVersion ?? 0), account: accountPublicShape(account) });
  });

  // "Continue with Google": the app signs in with Google, sends us the ID token, and we verify it. Same Turnstile and
  // rate-limit protection as email login. An existing account with the same (Google-verified) email is signed into, so
  // one person never ends up with two accounts; otherwise a new account is created, already email-verified.
  router.post('/google', async (req, res) => {
    const parsed = z.object({ idToken: z.string().min(20).max(4096), turnstileToken: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input', code: 'INVALID_INPUT' });
    if (!googleConfigured()) {
      return res.status(503).json({ error: 'Google sign-in is not set up yet.', code: 'GOOGLE_NOT_CONFIGURED' });
    }
    if (!isFeatureEnabled('googleSignIn')) {
      return res.status(503).json({ error: 'Google sign-in is temporarily unavailable.', code: 'GOOGLE_NOT_CONFIGURED' });
    }
    const ip = clientIp(req);
    if (!checkAuthRateLimit(ip, 'google')) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
    }
    recordAuthAttempt(ip, 'google');

    const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
    if (!turnstile.ok) {
      return res.status(400).json({ error: 'Verification failed - please retry.', code: 'TURNSTILE_FAILED' });
    }

    const identity = await verifyGoogle(parsed.data.idToken);
    if (!identity || !identity.emailVerified) {
      return res.status(401).json({ error: 'Google sign-in failed. Please try again.', code: 'GOOGLE_FAILED' });
    }

    const now = new Date().toISOString();
    let account = accountsById.findOneByField('googleSub', identity.sub) ?? findAccountByEmail(identity.email);
    let created = false;
    if (account) {
      account = { ...account, googleSub: identity.sub, emailVerified: true, updatedAt: now };
      accountsById.set(account.id, account);
    } else {
      account = {
        id: `user-${uuid()}`,
        email: identity.email,
        // No password for Google-only accounts: a random hash nobody knows. They can still use "forgot password" later.
        passwordHash: await hashPassword(randomBytes(32).toString('hex')),
        emailVerified: true,
        googleSub: identity.sub,
        createdAt: now,
        updatedAt: now,
      };
      accountsById.set(account.id, account);
      getOrCreatePsuId(account.id);
      created = true;
    }
    clearAuthAttempts(ip, 'google');
    migrateIfGuest(req, account.id);
    recordEvent({ userId: account.id, eventType: created ? 'USER_REGISTERED' : 'USER_LOGIN', feature: 'auth' });
    res.json({ token: signUserToken(account.id, account.tokenVersion ?? 0), account: accountPublicShape(account), created });
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

  // --- Password reset ---------------------------------------------------------
  // forgot-password always answers the same generic success (never reveals whether an email has an account) and is
  // rate limited per ip+email like login. The emailed link opens /reset-password/ (a small static page served by
  // this server), which posts the new password to /auth/reset-password.
  const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), turnstileToken: z.string().optional() });
  router.post('/forgot-password', async (req, res) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' });
    const { email, turnstileToken } = parsed.data;
    const ip = clientIp(req);
    if (!checkAuthRateLimit(ip, email)) return res.status(429).json({ error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
    recordAuthAttempt(ip, email);
    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) return res.status(400).json({ error: 'Verification failed - please retry.', code: 'TURNSTILE_FAILED' });
    requestPasswordReset(email).catch((err) => reportError('forgot-password', err));
    res.json({ ok: true });
  });

  const resetSchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(200) });
  router.post('/reset-password', async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Use a password of at least 8 characters.', code: 'INVALID_INPUT' });
    const ip = clientIp(req);
    if (!checkAuthRateLimit(ip, 'reset')) return res.status(429).json({ error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
    recordAuthAttempt(ip, 'reset');
    const result = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (result !== 'ok') return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.', code: 'INVALID_TOKEN' });
    res.json({ ok: true });
  });

  // Revokes just the token used for this request (by its JWT id), so signing out on one device never signs the
  // user out of their other devices.
  router.post('/logout', (req, res) => {
    const { jti, exp } = req.auth ?? {};
    if (jti) revokedTokens.set(jti, { jti, exp: exp ?? 0 }); // this device's session ends; other devices stay signed in
    res.json({ ok: true });
  });

  router.get('/export', requireAccount, (req, res) => {
    const userId = req.auth!.userId;
    res.json({
      exportedAt: new Date().toISOString(),
      account: accountPublicShape(accountsById.get(userId)!),
      data: exportAllUserData(userId),
    });
  });

  router.delete('/account', requireAccount, (req, res) => {
    const userId = req.auth!.userId;
    // Revoke the session first so the token that asked for deletion cannot be used to recreate data afterwards.
    if (req.auth!.jti) revokedTokens.set(req.auth!.jti, { jti: req.auth!.jti, exp: req.auth!.exp ?? 0 });
    const removed = deleteAllUserData(userId);
    accountsById.delete(userId);
    res.json({ ok: true, removed });
  });

  return router;
}
