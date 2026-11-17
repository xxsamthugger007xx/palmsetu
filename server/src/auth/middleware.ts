import { Request, Response, NextFunction } from 'express';
import { resolveAuthContext, AuthContext } from './context';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Attaches req.auth on every request - always succeeds (falls back to an
 * unverified guest identity, see context.ts), so this is safe to mount
 * globally without changing behavior for routes that don't care about auth
 * at all yet. */
export function attachAuthContext(req: Request, _res: Response, next: NextFunction): void {
  req.auth = resolveAuthContext(req);
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
