import { Router } from 'express';
import { getFeatureFlags } from '../data/featureFlags';

/**
 * Public, unauthenticated app-config endpoint the mobile app fetches once
 * at startup, so feature flags set from the admin panel take effect for
 * every install without an app-store release. No secrets live here - just
 * which features are currently switched on.
 */
export function buildConfigRouter() {
  const router = Router();

  router.get('/feature-flags', (_req, res) => {
    const flags = getFeatureFlags();
    res.json({
      flags: Object.fromEntries(flags.map((f) => [f.key, f.enabled])),
    });
  });

  return router;
}
