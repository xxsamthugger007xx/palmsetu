/**
 * Cloudflare Turnstile server-side verification. Used to protect signup and
 * login instead of email OTP - the client solves the Turnstile widget and
 * sends the resulting token here, which is verified against Cloudflare's
 * siteverify endpoint before any account is created or logged into.
 *
 * TURNSTILE_SECRET_KEY has no default and nothing fakes a pass when it is
 * unset - in that case verification is skipped with a loud warning, which is
 * acceptable for local development (no real secret exists in this repo) but
 * must never happen in a deployed environment. This mirrors how this app
 * already treats every other missing third-party credential (Gemini, image
 * cloud storage) - an honest, logged gap, not a fabricated success.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let warnedMissingSecret = false;

export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (!warnedMissingSecret) {
      console.warn('[auth/turnstile] TURNSTILE_SECRET_KEY is not set - skipping bot-check verification. This is only acceptable in local development.');
      warnedMissingSecret = true;
    }
    return { ok: true };
  }

  if (!token) {
    return { ok: false, reason: 'Missing verification token' };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    const data = (await res.json()) as { success: boolean; ['error-codes']?: string[] };
    if (!data.success) {
      return { ok: false, reason: (data['error-codes'] ?? []).join(', ') || 'Verification failed' };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[auth/turnstile] siteverify request failed:', err);
    return { ok: false, reason: 'Could not verify - please try again' };
  }
}
