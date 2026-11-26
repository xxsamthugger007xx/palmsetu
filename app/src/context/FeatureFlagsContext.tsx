import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'solune.featureFlags';

type FlagMap = Record<string, boolean>;

interface FeatureFlagsContextValue {
  /** true until the flags are known locally (cache or network) - callers should not hide anything while this is true, to avoid a flash of missing content. */
  loading: boolean;
  isEnabled: (key: string) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({ loading: true, isEnabled: () => true });

/**
 * App-wide feature flags, set live from the admin panel (see
 * server/src/data/featureFlags.ts, GET /config/feature-flags - public, no
 * auth). Fetched once per app session and cached in AsyncStorage so a cold
 * start with no network still reflects the last known flags rather than
 * silently defaulting everything back on. An unknown key (one the cached
 * copy predates) defaults to enabled - never to a broken/hidden state.
 */
export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FlagMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((cached) => {
        if (cached) setFlags(JSON.parse(cached));
      })
      .catch(() => {})
      .finally(() => {
        fetch(`${BASE_URL}/config/feature-flags`)
          .then((r) => r.json())
          .then((body: { flags: FlagMap }) => {
            setFlags(body.flags ?? {});
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(body.flags ?? {})).catch(() => {});
          })
          .catch(() => {
            // Network failed - keep whatever the cache (or the all-enabled default) already set.
          })
          .finally(() => setLoading(false));
      });
  }, []);

  const isEnabled = (key: string) => flags[key] !== false;

  return (
    <FeatureFlagsContext.Provider value={{ loading, isEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
