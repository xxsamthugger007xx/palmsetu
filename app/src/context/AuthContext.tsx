import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { tokenStorage } from '../services/tokenStorage';
import { setCrashUser } from '../services/crashReporting';
import { authApi, AccountPublic } from '../services/authApi';
import { setAuthToken, setSessionInvalidHandler } from '../services/apiRequest';
import { configurePurchases } from '../services/purchases';
import { color } from '../theme/tokens';

/**
 * Guest-first auth: on first launch (no token in SecureStore at all), a
 * guest session is created automatically and silently - no login prompt,
 * no blocked screens. Every *Api.ts request then carries whichever token is
 * current (guest or real account) via apiRequest.ts's setAuthToken(), which
 * every backend route resolves through auth/context.ts.
 *
 * SecureStore (not AsyncStorage) holds the token itself, since it's a bearer
 * credential - AsyncStorage remains fine for non-sensitive UI cache (see
 * UserProfileContext) but a session token gets the OS keychain/keystore.
 */
const TOKEN_KEY = 'solune.authToken';

interface AuthContextValue {
  loading: boolean;
  isGuest: boolean;
  account: AccountPublic | null;
  signUp: (email: string, password: string, turnstileToken: string | undefined) => Promise<void>;
  logIn: (email: string, password: string, turnstileToken: string | undefined) => Promise<void>;
  signInWithGoogle: (idToken: string, turnstileToken: string | undefined) => Promise<void>;
  logOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);
  const [account, setAccount] = useState<AccountPublic | null>(null);

  const bootstrap = async () => {
    try {
      let token = await tokenStorage.get(TOKEN_KEY);
      if (!token) {
        const guest = await authApi.createGuestSession();
        token = guest.token;
        await tokenStorage.set(TOKEN_KEY, token);
      }
      setAuthToken(token);

      const me = await authApi.me();
      if (me.isGuest) {
        setIsGuest(true);
        setAccount(null);
        // Same id the backend resolves from this same token server-side
        // (see auth/context.ts) - configuring RevenueCat with it is what
        // lets POST /billing/confirm-purchase look the purchase up without
        // the client needing to separately prove who it is.
        configurePurchases(me.userId);
      } else {
        setIsGuest(false);
        setAccount(me.account);
        configurePurchases(me.account.id);
      }
    } catch {
      // Offline on first launch, or the stored token has expired/is
      // invalid server-side - fall back to an unauthenticated guest state
      // locally rather than blocking the app. The next successful request
      // (or app restart with connectivity) will create a fresh guest
      // session via apiRequest.ts's 401 handling is not needed here since
      // every route tolerates an unresolved guest identity.
      setIsGuest(true);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  // When the server rejects our token (expired, signed out from another place, account deleted, password reset),
  // fall back to a fresh guest session instead of leaving every screen failing with 401s.
  const recovering = useRef(false);
  useEffect(() => {
    setSessionInvalidHandler(async () => {
      if (recovering.current) return;
      recovering.current = true;
      try {
        const guest = await authApi.createGuestSession();
        await tokenStorage.set(TOKEN_KEY, guest.token);
        setAuthToken(guest.token);
        setIsGuest(true);
        setAccount(null);
        configurePurchases(guest.guestId);
      } catch {
        // offline: the next request that hits 401 will retry
      } finally {
        recovering.current = false;
      }
    });
    return () => setSessionInvalidHandler(null);
  }, []);

  useEffect(() => {
    bootstrap();
  }, []);

  // Anonymous id only (never the email) so a crash can be traced to one person's repeated problem.
  useEffect(() => { setCrashUser(account?.id ?? null); }, [account?.id]);

  const applyAuthResult = async (result: { token: string; account: AccountPublic }) => {
    await tokenStorage.set(TOKEN_KEY, result.token);
    setAuthToken(result.token);
    setIsGuest(false);
    setAccount(result.account);
    // Premium is attached to the account, so RevenueCat must now act as this account on this device.
    configurePurchases(result.account.id);
  };

  const signUp = async (email: string, password: string, turnstileToken: string | undefined) => {
    const result = await authApi.signUp(email, password, turnstileToken);
    await applyAuthResult(result);
  };

  const logIn = async (email: string, password: string, turnstileToken: string | undefined) => {
    const result = await authApi.logIn(email, password, turnstileToken);
    await applyAuthResult(result);
  };

  const signInWithGoogle = async (idToken: string, turnstileToken: string | undefined) => {
    const result = await authApi.google(idToken, turnstileToken);
    await applyAuthResult(result);
  };

  // Signing out returns to a fresh guest session, not a logged-out dead end - consistent with "guest first":
  // there is always something usable behind every screen, logged in or not.
  const resetToGuest = async () => {
    const guest = await authApi.createGuestSession();
    await tokenStorage.set(TOKEN_KEY, guest.token);
    setAuthToken(guest.token);
    setIsGuest(true);
    setAccount(null);
    configurePurchases(guest.guestId);
  };

  const logOut = async () => {
    await authApi.logOut().catch(() => {}); // revokes this device's token server-side; other devices stay signed in
    await resetToGuest();
  };

  const deleteAccount = async () => {
    await authApi.deleteAccount(); // also revokes this session server-side, so there is nothing left to log out of
    await resetToGuest();
  };

  return (
    <AuthContext.Provider value={{ loading, isGuest, account, signUp, logIn, signInWithGoogle, logOut, deleteAccount, refresh: bootstrap }}>
      {loading ? (
        // Blocks every nested provider/screen from mounting (and firing its
        // own API calls) until a session token - guest or real - exists, so
        // nothing races ahead of apiRequest.ts's Authorization header being
        // set. Same spinner-over-blank-screen pattern as
        // RootNavigator.tsx's own loading gate.
        <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={color.accent} />
        </View>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
