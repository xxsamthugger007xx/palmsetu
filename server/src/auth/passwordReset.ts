import { createHash, randomBytes } from 'crypto';
import { accountsById, findAccountByEmail, passwordResetsByHash } from '../data/store';
import { hashPassword } from './passwords';
import { sendEmail } from '../email/sendEmail';

const TTL_MS = 60 * 60 * 1000; // 1 hour
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
}

/** Emails a one-time reset link if the address belongs to an account. Always resolves quietly either way, so the
 * HTTP response can never reveal whether an email is registered. Only a hash of the token is stored. */
export async function requestPasswordReset(email: string): Promise<void> {
  const account = findAccountByEmail(email);
  if (!account) return;
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  passwordResetsByHash.set(sha256(token), {
    tokenHash: sha256(token), accountId: account.id, expiresAt: new Date(now + TTL_MS).toISOString(), usedAt: null, createdAt: new Date(now).toISOString(),
  });
  const link = `${baseUrl()}/reset-password/?token=${token}`;
  await sendEmail({
    to: account.email,
    subject: 'Reset your Palm Setu password',
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #430194;">Reset your password</h2>
        <p>We received a request to reset the password for your Palm Setu account. Tap the button to choose a new one.</p>
        <p style="margin: 28px 0;">
          <a href="${link}" style="background: #430194; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Choose a new password</a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 1 hour and works once. If you didn't ask for this, you can ignore this email - your password won't change.</p>
      </div>`,
  });
}

export type ResetResult = 'ok' | 'invalid';

/** Validates the token, sets the new password, ends every existing session (tokenVersion bump), burns the token. */
export async function completePasswordReset(token: string, newPassword: string): Promise<ResetResult> {
  const hash = sha256(token);
  const rec = passwordResetsByHash.get(hash);
  if (!rec || rec.usedAt || new Date(rec.expiresAt).getTime() < Date.now()) return 'invalid';
  const account = accountsById.get(rec.accountId);
  if (!account) return 'invalid';

  const passwordHash = await hashPassword(newPassword);
  accountsById.set(account.id, {
    ...account, passwordHash, tokenVersion: (account.tokenVersion ?? 0) + 1, emailVerified: true, updatedAt: new Date().toISOString(),
  });
  passwordResetsByHash.set(hash, { ...rec, usedAt: new Date().toISOString() });
  return 'ok';
}
