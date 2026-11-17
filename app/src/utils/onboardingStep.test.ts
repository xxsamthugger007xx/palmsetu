import { describe, expect, it } from 'vitest';
import { nextAstrologyOnboardingStep } from './onboardingStep';
import { BirthProfile, OnboardingDraft } from '../types/astrology';

function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    userId: 'u1',
    preferredSystem: null,
    birthDate: null,
    birthTime: null,
    birthTimeSkipped: false,
    birthPlace: null,
    birthLatitude: null,
    birthLongitude: null,
    timezone: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const fullProfile = {
  userId: 'u1',
  birthDate: '1995-03-10',
  birthTime: '08:00:00',
  birthPlace: 'Mumbai, India',
  birthLatitude: 19.076,
  birthLongitude: 72.8777,
  preferredSystem: 'vedic',
  timezone: 'Asia/Kolkata',
  natal: {} as any,
  updatedAt: '2026-01-01T00:00:00.000Z',
} as BirthProfile;

describe('nextAstrologyOnboardingStep', () => {
  it('starts at system when there is no draft and no profile', () => {
    expect(nextAstrologyOnboardingStep(null, null)).toBe('system');
  });

  it('moves to dob once a system is chosen', () => {
    expect(nextAstrologyOnboardingStep(null, draft({ preferredSystem: 'vedic' }))).toBe('dob');
  });

  it('moves to tob once a date is chosen', () => {
    expect(nextAstrologyOnboardingStep(null, draft({ preferredSystem: 'vedic', birthDate: '1995-03-10' }))).toBe('tob');
  });

  it('moves to place once time is answered (set)', () => {
    const d = draft({ preferredSystem: 'vedic', birthDate: '1995-03-10', birthTime: '08:00:00' });
    expect(nextAstrologyOnboardingStep(null, d)).toBe('place');
  });

  it('moves to place once time is explicitly skipped', () => {
    const d = draft({ preferredSystem: 'vedic', birthDate: '1995-03-10', birthTime: null, birthTimeSkipped: true });
    expect(nextAstrologyOnboardingStep(null, d)).toBe('place');
  });

  it('stays at tob if time has not been answered at all', () => {
    const d = draft({ preferredSystem: 'vedic', birthDate: '1995-03-10', birthTime: null, birthTimeSkipped: false });
    expect(nextAstrologyOnboardingStep(null, d)).toBe('tob');
  });

  it('moves to confirm once place is chosen', () => {
    const d = draft({
      preferredSystem: 'vedic', birthDate: '1995-03-10', birthTime: null, birthTimeSkipped: true,
      birthPlace: 'Mumbai, India', birthLatitude: 19.076, birthLongitude: 72.8777, timezone: 'Asia/Kolkata',
    });
    expect(nextAstrologyOnboardingStep(null, d)).toBe('confirm');
  });

  it('is done once the real profile exists, regardless of draft state', () => {
    expect(nextAstrologyOnboardingStep(fullProfile, null)).toBe('done');
    expect(nextAstrologyOnboardingStep(fullProfile, draft())).toBe('done');
  });

  it('a returning pre-existing user (identity only, no profile, no draft) starts at system', () => {
    expect(nextAstrologyOnboardingStep(null, null)).toBe('system');
  });
});
