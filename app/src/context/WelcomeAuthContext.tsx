import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'solune.hasSeenWelcomeAuth';

interface WelcomeAuthContextValue {
  hasSeenWelcomeAuth: boolean;
  loading: boolean;
  completeWelcomeAuth: () => Promise<void>;
}

const WelcomeAuthContext = createContext<WelcomeAuthContextValue | undefined>(undefined);

/** Whether the person has been shown (and dismissed, by signing in or
 * tapping Skip) the one-time "Sign in with Google" screen shown right
 * after the intro carousel, before the guest name/gender form. Same
 * persisted-flag pattern as OnboardingIntroContext, so it is never shown
 * again once dismissed, even to an unconverted guest. */
export function WelcomeAuthProvider({ children }: { children: React.ReactNode }) {
  const [hasSeenWelcomeAuth, setHasSeenWelcomeAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'true') setHasSeenWelcomeAuth(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const completeWelcomeAuth = async () => {
    setHasSeenWelcomeAuth(true);
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  };

  return (
    <WelcomeAuthContext.Provider value={{ hasSeenWelcomeAuth, loading, completeWelcomeAuth }}>
      {children}
    </WelcomeAuthContext.Provider>
  );
}

export function useWelcomeAuth() {
  const ctx = useContext(WelcomeAuthContext);
  if (!ctx) throw new Error('useWelcomeAuth must be used within a WelcomeAuthProvider');
  return ctx;
}
