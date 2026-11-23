import { randomBytes } from 'crypto';
import { emailVerificationsByToken } from '../data/store';
import { sendEmail } from '../email/sendEmail';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
}

/** Creates a fresh one-time verification token for this account and emails
 * it as a link. Fire-and-forget from the caller's point of view - a failed
 * send is logged (see sendEmail.ts) but never blocks signup/resend. */
export async function sendVerificationEmail(accountId: string, email: string): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  emailVerificationsByToken.set(token, { token, accountId, expiresAt });

  const link = `${baseUrl()}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your Palm Setu email',
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #430194;">Verify your email</h2>
        <p>Tap the button below to confirm this email address for your Palm Setu account.</p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="background: #430194; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify email</a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 24 hours. If you did not create a Palm Setu account, you can ignore this email.</p>
      </div>
    `,
  });
}

/** Verifies and consumes a token, returning the accountId it belonged to,
 * or null if the token is unknown, already used, or expired. */
export function consumeVerificationToken(token: string): string | null {
  const record = emailVerificationsByToken.get(token);
  if (!record) return null;
  emailVerificationsByToken.delete(token);
  if (new Date(record.expiresAt).getTime() < Date.now()) return null;
  return record.accountId;
}
