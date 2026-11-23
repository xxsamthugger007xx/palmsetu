import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendEmail, emailProvider } from './sendEmail';

const ENV = ['EMAIL_PROVIDER', 'RESEND_API_KEY', 'BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
afterEach(() => { vi.restoreAllMocks(); for (const k of ENV) delete process.env[k]; });
const mail = { to: 'a@b.com', subject: 'Hi', html: '<p>x</p>' };

describe('email providers', () => {
  it('auto-selects by which key is set, and EMAIL_PROVIDER overrides', () => {
    expect(emailProvider()).toBe('smtp');
    process.env.BREVO_API_KEY = 'b'; expect(emailProvider()).toBe('brevo');
    process.env.RESEND_API_KEY = 'r'; expect(emailProvider()).toBe('resend');
    process.env.EMAIL_PROVIDER = 'smtp'; expect(emailProvider()).toBe('smtp');
  });

  it('sends through Resend with the right request', async () => {
    process.env.RESEND_API_KEY = 'rk'; process.env.EMAIL_FROM = 'no-reply@palmsetu.com';
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await sendEmail(mail)).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer rk');
    expect(JSON.parse(init.body)).toMatchObject({ from: 'Palm Setu <no-reply@palmsetu.com>', to: ['a@b.com'], subject: 'Hi' });
  });

  it('sends through Brevo with the right request', async () => {
    process.env.BREVO_API_KEY = 'bk'; process.env.EMAIL_FROM = 'no-reply@palmsetu.com';
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    expect(await sendEmail(mail)).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('bk');
    expect(JSON.parse(init.body)).toMatchObject({ sender: { email: 'no-reply@palmsetu.com' }, to: [{ email: 'a@b.com' }], htmlContent: '<p>x</p>' });
  });

  it('returns false (never throws) when the provider rejects or is misconfigured', async () => {
    process.env.RESEND_API_KEY = 'rk'; // no EMAIL_FROM
    expect(await sendEmail(mail)).toBe(false);
    process.env.EMAIL_FROM = 'x@y.com';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad key', { status: 401 }));
    expect(await sendEmail(mail)).toBe(false);
  });

  it('returns false with nothing configured', async () => { expect(await sendEmail(mail)).toBe(false); });
});
