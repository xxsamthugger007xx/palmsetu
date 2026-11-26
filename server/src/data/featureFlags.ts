import { getConfig, setConfig } from './runtimeConfig';

/**
 * App-wide feature flags, editable live from the admin panel's Feature
 * Flags tab (GET/PUT /admin/feature-flags, super_admin only for the
 * write) with no redeploy needed. The mobile app reads the public
 * GET /config/feature-flags endpoint once at startup (see
 * routes/config.ts) and caches it for the session.
 *
 * A flag absent from the stored list (e.g. a brand-new one added here
 * after a user's app already fetched an older list) defaults to enabled,
 * never to a silent/broken state - see isFeatureEnabled().
 */
export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const CONFIG_KEY = 'featureFlags';

const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: 'soulmateSketch', label: 'Soulmate Sketch', description: 'Soulmate Sketch feature (intro tile, questionnaire, results) across the app.', enabled: true },
  { key: 'palmRescan', label: 'Palm Rescan', description: 'Lets a user rescan their palm from Profile, replacing their existing reading.', enabled: true },
  { key: 'googleSignIn', label: 'Google Sign-In', description: 'Shows the "Sign in with Google" button on auth screens.', enabled: true },
  { key: 'vastu', label: 'Vastu', description: 'Vastu Shastra feature (compass, property form, reports).', enabled: true },
  { key: 'gemstone', label: 'Gemstone', description: 'Gemstone recommendation feature.', enabled: true },
  { key: 'moonSign', label: 'Moon Sign / Western Astrology extras', description: 'Moon Sign and Western Astrology detail screens.', enabled: true },
  { key: 'relationships', label: 'Relationships / Partner Sync', description: 'Partner invitation and relationship compatibility reports.', enabled: true },
  { key: 'wellnessAiCompanion', label: 'Wellness AI Companion', description: 'AI-assisted chat within the Wellness section.', enabled: true },
];

export function getFeatureFlags(): FeatureFlag[] {
  return getConfig(CONFIG_KEY, DEFAULT_FLAGS);
}

export function isFeatureEnabled(key: string): boolean {
  const flag = getFeatureFlags().find((f) => f.key === key);
  return flag ? flag.enabled : true;
}

export function setFeatureFlag(key: string, enabled: boolean): FeatureFlag[] {
  const flags = getFeatureFlags();
  const idx = flags.findIndex((f) => f.key === key);
  if (idx === -1) return flags;
  const next = [...flags];
  next[idx] = { ...next[idx], enabled };
  return setConfig(CONFIG_KEY, next);
}

export function defaultFeatureFlags(): FeatureFlag[] {
  return DEFAULT_FLAGS.map((f) => ({ ...f }));
}
