import { SqliteMap } from './sqliteCollections';

/**
 * Generic, durable (SQLite-backed, survives restarts) key/value store for
 * app-wide runtime configuration that used to live only in hardcoded TS
 * files or env vars - pricing, AI budget caps, feature flags, assistant
 * config. Each config domain owns one key in this table and a typed
 * get/set pair in its own module (see data/pricing.ts, ai/budget.ts,
 * data/featureFlags.ts, data/assistantConfig.ts) built on top of
 * getConfig/setConfig below, so callers never touch this table directly.
 *
 * Editable live via the admin panel (no redeploy needed) - every setter
 * here is called only from an authenticated `super_admin` admin route.
 */
const appConfig = new SqliteMap<string, unknown>('appConfig');

export function getConfig<T>(key: string, fallback: T): T {
  const v = appConfig.get(key);
  return v !== undefined ? (v as T) : fallback;
}

export function setConfig<T>(key: string, value: T): T {
  appConfig.set(key, value);
  return value;
}
