import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'solune.hasSeenIntro';

interface OnboardingIntroContextValue {
  hasSeenIntro: boolean;
  loading: boolean;
  completeIntro: () => Promise<void>;
}

const OnboardingIntroContext = createContext<OnboardingIntroContextValue | undefined>(undefined);

export function OnboardingIntroProvider({ children }: { children: React.ReactNode }) {
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'true') setHasSeenIntro(true);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Called only on explicit Skip or Get Started, never just by reaching the
   * last page, so a user who force-quits mid-carousel sees it again next time. */
  const completeIntro = async () => {
    setHasSeenIntro(true);
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  };

  return (
    <OnboardingIntroContext.Provider value={{ hasSeenIntro, loading, completeIntro }}>
      {children}
    </OnboardingIntroContext.Provider>
  );
}

export function useOnboardingIntro() {
  const ctx = useContext(OnboardingIntroContext);
  if (!ctx) throw new Error('useOnboardingIntro must be used within an OnboardingIntroProvider');
  return ctx;
}
