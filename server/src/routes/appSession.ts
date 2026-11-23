import { Router, Request } from 'express';
import { z } from 'zod';
import { startSession, recordSessionEvent, endSession } from '../events/sessionTracker';

/**
 * Real mobile app session lifecycle endpoints, called by the Expo app's
 * instrumentation (see app/src/services/sessionTracker.ts). Not gated
 * behind a real account - guests get sessions too, attributed to their
 * guest id (req.auth.userId is always set, see auth/context.ts).
 */

function currentUserId(req: Request): string {
  return req.auth?.userId ?? 'demo-user';
}

const startSchema = z.object({
  device: z.string().max(100).nullable().optional(),
  os: z.string().max(100).nullable().optional(),
  appVersion: z.string().max(50).nullable().optional(),
  entryScreen: z.string().max(100).nullable().optional(),
});

const eventSchema = z.object({
  type: z.enum(['screen_view', 'feature_used', 'action', 'error']),
  screen: z.string().max(100).optional(),
  feature: z.string().max(50).optional(),
  action: z.string().max(100).optional(),
  // Deliberately capped and never free-form error text beyond a short
  // code/message - this must never carry a stack trace or PII.
  error: z.string().max(200).optional(),
});

const endSchema = z.object({
  reason: z.enum(['background', 'app_closed']),
});

export function buildAppSessionRouter() {
  const router = Router();

  router.post('/start', (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    const { sessionId, startedAt } = startSession({
      userId: currentUserId(req),
      device: parsed.data.device ?? null,
      os: parsed.data.os ?? null,
      appVersion: parsed.data.appVersion ?? null,
      entryScreen: parsed.data.entryScreen ?? null,
    });
    res.json({ sessionId, startedAt });
  });

  router.post('/:id/event', (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    const ok = recordSessionEvent(req.params.id, parsed.data);
    // Always 200 even if the session is unknown/closed - this is a
    // fire-and-forget beacon from the client, not something worth
    // surfacing an error for (the app never retries or blocks on it).
    res.json({ ok });
  });

  router.post('/:id/end', (req, res) => {
    const parsed = endSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    const ok = endSession(req.params.id, parsed.data.reason);
    res.json({ ok });
  });

  return router;
}
