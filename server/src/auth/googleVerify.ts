import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity { sub: string; email: string; emailVerified: boolean; name?: string }

/** OAuth client IDs this server accepts ID tokens for (web + Android + iOS), comma separated in GOOGLE_CLIENT_IDS. */
export function googleClientIds(): string[] {
  return (process.env.GOOGLE_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export const googleConfigured = () => googleClientIds().length > 0;

let client: OAuth2Client | null = null;

/**
 * Verifies a Google ID token (signature via Google's public keys, expiry, issuer, and that it was minted for one of OUR
 * client IDs). The app only ever sends the token; the email address is read from the verified token, never from the
 * request body, so nobody can claim someone else's email.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const audience = googleClientIds();
  if (audience.length === 0) return null;
  try {
    client ??= new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) return null;
    return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: p.email_verified === true, name: p.name };
  } catch {
    return null;
  }
}
