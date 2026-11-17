import { BirthProfile, OnboardingDraft } from '../types/astrology';

export type AstrologyOnboardingStep =
  | 'system'
  | 'dob'
  | 'tob'
  | 'place'
  | 'confirm'
  | 'done';

/**
 * Derives the next astrology-onboarding step purely from what has actually
 * been saved - a completed real BirthProfile means 'done' regardless of the
 * draft; otherwise we walk the draft's own fields in order. This is the
 * "progress is derived from real data" mechanism: there is no separate
 * unsynced flag anywhere that could disagree with what's in these two
 * records, so resuming after the app is closed mid-onboarding always lands
 * on the honest next step.
 */
export function nextAstrologyOnboardingStep(
  profile: BirthProfile | null,
  draft: OnboardingDraft | null,
): AstrologyOnboardingStep {
  if (profile && profile.birthDate && profile.preferredSystem) return 'done';

  if (!draft || !draft.preferredSystem) return 'system';
  if (!draft.birthDate) return 'dob';
  if (draft.birthTime === null && !draft.birthTimeSkipped) return 'tob';
  if (!draft.birthPlace || draft.birthLatitude == null || draft.birthLongitude == null) return 'place';
  return 'confirm';
}
