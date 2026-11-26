import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { astrologyApi } from '../services/astrologyApi';
import { useAuth } from './AuthContext';
import { Gender, FocusArea } from '../types/astrology';

export type { Gender, FocusArea };

export interface UserProfile {
  name: string;
  gender: Gender;
  /** What they want guidance on. Omitted when saving = keep what is stored. */
  focus?: FocusArea[];
  /** Which illustrated avatar to show, within the array for this gender
   * (see theme/avatars.ts). Assigned once server-side the first time
   * gender becomes known - never re-randomized. Null/undefined = no
   * avatar assigned yet (falls back to initials in AIAvatar.tsx). */
  avatarIndex?: number | null;
  /** An explicit user choice overriding avatarIndex (see theme/avatars.ts's
   * AVATAR_CHOICES) - picked from the full set regardless of gender. */
  avatarKey?: string | null;
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
  /** Explicit "pick any avatar" choice (see theme/avatars.ts's
   * AVATAR_CHOICES) - pass null to clear back to the automatic default. */
  setAvatarKey: (avatarKey: string | null) => Promise<void>;
  clearProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { account, isGuest } = useAuth();
  // Changes when someone logs in/out, signs up or is signed out remotely. The identity must then be re-fetched for the
  // NEW user - otherwise a second device keeps showing (or lacking) the previous session's name until a restart.
  const userKey = isGuest ? 'guest' : account?.id ?? 'guest';
  const firstRun = React.useRef(true);

  useEffect(() => {
    let cancelled = false;
    const isFirst = firstRun.current;
    firstRun.current = false;

    if (!isFirst) { setProfileState(null); setLoading(true); AsyncStorage.removeItem(STORAGE_KEY).catch(() => {}); }

    // 1) Instant paint from the local cache, if any (app start only).
    if (isFirst) AsyncStorage.getItem(STORAGE_KEY)
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
        const next: UserProfile = { name: identity.name, gender: identity.gender ?? 'prefer-not-to-say', focus: identity.focus ?? [], avatarIndex: identity.avatarIndex, avatarKey: identity.avatarKey };
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
  }, [userKey]);

  const setProfile = async (next: UserProfile) => {
    // Optimistic local update so the UI (e.g. the onboarding screen's own
    // "continue" button) doesn't wait on the network, then persist to the
    // backend for real. AsyncStorage is updated in both branches purely as
    // a cache mirror of whatever is currently believed to be true.
    next = { ...next, focus: next.focus ?? profile?.focus ?? [] };
    setProfileState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const saved = await astrologyApi.saveIdentity({ name: next.name, gender: next.gender, focus: next.focus });
    // The server (not the client) assigns avatarIndex the first time
    // gender becomes known - merge its real response back in rather than
    // keeping the optimistic value above, which never had an avatarIndex
    // at all on a first save.
    const withAvatar: UserProfile = { ...next, avatarIndex: saved.avatarIndex, avatarKey: saved.avatarKey };
    setProfileState(withAvatar);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(withAvatar));
  };

  const setAvatarKey = async (avatarKey: string | null) => {
    const saved = await astrologyApi.setAvatarKey(avatarKey);
    setProfileState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, avatarKey: saved.avatarKey };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
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
    <UserProfileContext.Provider value={{ profile, loading, setProfile, setAvatarKey, clearProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within a UserProfileProvider');
  return ctx;
}
