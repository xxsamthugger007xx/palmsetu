import { Request, Response, NextFunction } from 'express';
import { resolveAuthContext, AuthContext } from './context';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      /** Set by the admin API's session check (routes/admin.ts) after a valid admin login token. */
      admin?: import('./adminAuth').AdminSessionContext;
      adminRole?: string;
      /** Raw request bytes, kept by the JSON body parser (index.ts) so webhook signatures can be verified. */
      rawBody?: Buffer;
    }
  }
}

/** Attaches req.auth on every request - always succeeds (falls back to an
 * unverified guest identity, see context.ts), so this is safe to mount
 * globally without changing behavior for routes that don't care about auth
 * at all yet. */
// Paths that must work with no valid session (creating one, signing in, resetting a password), and the admin
// API/panel, which authenticate with their own admin session tokens rather than app JWTs.
const SESSIONLESS = new Set(['/health', '/auth/guest', '/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email']);
const isSessionless = (path: string) => SESSIONLESS.has(path) || path.startsWith('/admin');

export function attachAuthContext(req: Request, res: Response, next: NextFunction): void {
  const ctx = resolveAuthContext(req);
  if (ctx.invalidSession && !isSessionless(req.path)) {
    // The app reacts to this code by dropping the dead token and starting a fresh guest session.
    res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'SESSION_INVALID' });
    return;
  }
  req.auth = ctx;
  next();
}

/** Route-level gate for anything that must be tied to a real, signed-in
 * account rather than a guest session (saving a permanent report,
 * subscribing, exporting/deleting account data). Returns 401 with a code
 * the frontend branches on to show the contextual sign-up prompt instead of
 * a generic error. */
export function requireAccount(req: Request, res: Response, next: NextFunction): void {
  const auth = req.auth ?? resolveAuthContext(req);
  if (auth.isGuest) {
    res.status(401).json({ error: 'Create a free account to save this.', code: 'ACCOUNT_REQUIRED' });
    return;
  }
  next();
}
