import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { astrologyApi } from '../services/astrologyApi';
import { Gender } from '../types/astrology';

export type { Gender };

export interface UserProfile {
  name: string;
  gender: Gender;
}

/**
 * This used to be a SEPARATE, local-only profile system: {name, gender}
 * stored purely in AsyncStorage, never synced to the backend at all - a
 * user's name was never actually saved to their account server-side, only
 * to that one device's local storage. It is now backed by the real
 * server-persisted UserIdentity record (GET/PUT /astrology/identity, see
 * server/src/types/astrology.ts), with AsyncStorage kept only as a fast
 * local cache so the UI has something to render instantly on next launch
 * while the real fetch is in flight - never as the source of truth. A
 * failed or slow network fetch no longer means "no profile"; it means
 * "show the cached one, if any, while the real one loads."
 */
const STORAGE_KEY = 'solune.userProfile';

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  setProfile: (profile: UserProfile) => Promise<void>;
  clearProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 1) Instant paint from the local cache, if any.
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && raw) setProfileState(JSON.parse(raw));
      })
      .catch(() => {
        // Cache read failures (corrupt storage, private-window style
        // restrictions) are not fatal - the backend fetch below is the
        // real source of truth regardless.
      });

    // 2) Real source of truth: fetch the backend-persisted identity. If
    // this fails (offline, server down, or the user has never saved an
    // identity yet - 404), silently keep whatever the cache produced
    // rather than surfacing a network error on app launch; screens that
    // actively need the profile (onboarding, edit profile) handle their
    // own save/retry errors.
    astrologyApi.getIdentity()
      .then((identity) => {
        if (cancelled) return;
        const next: UserProfile = { name: identity.name, gender: identity.gender ?? 'prefer-not-to-say' };
        setProfileState(next);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      })
      .catch(() => {
        // No identity on the backend yet, or unreachable - leave the
        // cached value (or null) as-is.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setProfile = async (next: UserProfile) => {
    // Optimistic local update so the UI (e.g. the onboarding screen's own
    // "continue" button) doesn't wait on the network, then persist to the
    // backend for real. AsyncStorage is updated in both branches purely as
    // a cache mirror of whatever is currently believed to be true.
    setProfileState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    await astrologyApi.saveIdentity({ name: next.name, gender: next.gender });
  };

  const clearProfile = async () => {
    setProfileState(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    // Intentionally does not delete the backend identity record - "sign
    // out" on this device should not be destructive to the account, and
    // there is no real authentication system yet (see currentUserId() in
    // every route file) to scope a delete to "this device only" anyway.
  };

  return (
    <UserProfileContext.Provider value={{ profile, loading, setProfile, clearProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within a UserProfileProvider');
  return ctx;
}
