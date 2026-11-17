import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { astrologyApi } from '../services/astrologyApi';
import { BirthProfile, OnboardingDraft } from '../types/astrology';
import { nextAstrologyOnboardingStep, AstrologyOnboardingStep } from '../utils/onboardingStep';

/**
 * Derives whether the current user still needs to go through the
 * astrology-onboarding steps (system/DOB/TOB/place/confirm), and which step
 * to resume at - entirely from the real backend records (BirthProfile,
 * OnboardingDraft). There is no separate "onboarding complete" flag stored
 * anywhere on the client: a user who has UserIdentity but no BirthProfile
 * (every pre-existing user before this feature shipped) lands here exactly
 * once, resumes at whatever their OnboardingDraft already reflects, and
 * `step` becomes 'done' the moment a real BirthProfile with
 * preferredSystem + birthDate exists.
 */
function useAstrologyOnboardingStatusInternal() {
  const [step, setStep] = useState<AstrologyOnboardingStep | null>(null); // null = still loading
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.allSettled([astrologyApi.getProfile(), astrologyApi.getOnboardingDraft()])
      .then(([profileResult, draftResult]) => {
        const profile: BirthProfile | null = profileResult.status === 'fulfilled' ? profileResult.value : null;
        const draft: OnboardingDraft | null = draftResult.status === 'fulfilled' ? draftResult.value : null;
        setStep(nextAstrologyOnboardingStep(profile, draft));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { step, loading, refresh };
}

type AstrologyOnboardingStatusValue = ReturnType<typeof useAstrologyOnboardingStatusInternal>;
const AstrologyOnboardingStatusContext = createContext<AstrologyOnboardingStatusValue | undefined>(undefined);

/** Provides the same { step, loading, refresh } to the whole app, so a
 * step screen (e.g. OnboardingConfirmScreen, after it saves the real
 * BirthProfile) can call `refresh()` and have RootNavigator's gating react
 * immediately, instead of each needing its own independent fetch/poll. */
export function AstrologyOnboardingStatusProvider({ children }: { children: React.ReactNode }) {
  const value = useAstrologyOnboardingStatusInternal();
  return (
    <AstrologyOnboardingStatusContext.Provider value={value}>
      {children}
    </AstrologyOnboardingStatusContext.Provider>
  );
}

export function useAstrologyOnboardingStatus() {
  const ctx = useContext(AstrologyOnboardingStatusContext);
  if (!ctx) throw new Error('useAstrologyOnboardingStatus must be used within an AstrologyOnboardingStatusProvider');
  return ctx;
}
