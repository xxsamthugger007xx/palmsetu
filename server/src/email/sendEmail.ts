import nodemailer from 'nodemailer';
import { reportError } from '../ops/alerts';

/**
 * Transactional email via plain SMTP (nodemailer) - works with any SMTP
 * provider, including a free personal Gmail account via an App Password
 * (no third-party signup required - see .env.example). Used for email
 * verification only right now (see auth/emailVerification.ts).
 *
 * Without SMTP_HOST/SMTP_USER/SMTP_PASS configured, sendEmail() logs a
 * warning and returns false instead of throwing - a missing config should
 * never break signup, it should just mean no verification email goes out
 * (account creation still succeeds, same as today).
 */

let warnedMissingConfig = false;
let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  if (!cachedTransport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS (nodemailer handles the upgrade)
      auth: { user, pass },
    });
  }
  return cachedTransport;
}

type Mail = { to: string; subject: string; html: string };
const fromName = () => process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Palm Setu';
const fromAddress = () => process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '';

/** Which backend sends mail. EMAIL_PROVIDER wins; otherwise the first configured API key; otherwise SMTP.
 * Gmail SMTP caps at ~500 messages/day, so production should use one of the API providers (free tiers are fine to start). */
export function emailProvider(): 'resend' | 'brevo' | 'smtp' {
  const forced = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (forced === 'resend' || forced === 'brevo' || forced === 'smtp') return forced;
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.BREVO_API_KEY) return 'brevo';
  return 'smtp';
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

export async function sendEmail(opts: Mail): Promise<boolean> {
  const provider = emailProvider();
  try {
    if (provider === 'resend') {
      const key = process.env.RESEND_API_KEY;
      if (!key || !fromAddress()) throw new Error('RESEND_API_KEY and EMAIL_FROM must both be set');
      await postJson('https://api.resend.com/emails', { authorization: `Bearer ${key}` },
        { from: `${fromName()} <${fromAddress()}>`, to: [opts.to], subject: opts.subject, html: opts.html });
      return true;
    }
    if (provider === 'brevo') {
      const key = process.env.BREVO_API_KEY;
      if (!key || !fromAddress()) throw new Error('BREVO_API_KEY and EMAIL_FROM must both be set');
      await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': key },
        { sender: { name: fromName(), email: fromAddress() }, to: [{ email: opts.to }], subject: opts.subject, htmlContent: opts.html });
      return true;
    }
  } catch (err) {
    reportError('email', err, { provider });
    return false;
  }

  const transport = getTransport();
  if (!transport) {
    if (!warnedMissingConfig) {
      console.warn('[email] No email provider configured (RESEND_API_KEY / BREVO_API_KEY / SMTP_*) - skipping email send (see .env.example).');
      warnedMissingConfig = true;
    }
    return false;
  }
  try {
    await transport.sendMail({ from: `"${fromName()}" <${fromAddress()}>`, to: opts.to, subject: opts.subject, html: opts.html });
    return true;
  } catch (err) {
    reportError('email', err, { provider: 'smtp' });
    return false;
  }
}
