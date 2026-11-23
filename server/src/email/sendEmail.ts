import nodemailer from 'nodemailer';

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

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    if (!warnedMissingConfig) {
      console.warn('[email] SMTP_HOST/SMTP_USER/SMTP_PASS is not set - skipping email send (see .env.example).');
      warnedMissingConfig = true;
    }
    return false;
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'Palm Setu';

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error('[email] SMTP send failed:', err);
    return false;
  }
}
