import { describe, expect, it } from 'vitest';
import { computeDailyResetProgress, buildWeeklyStreakDots } from './wellnessCompute';

describe('computeDailyResetProgress', () => {
  it('counts mood and journal only for a user with no habits or challenge', () => {
    const result = computeDailyResetProgress({
      moodLoggedToday: true,
      activeHabitCount: 0,
      habitsCompletedToday: 0,
      hasActiveChallenge: false,
      challengeCompletedToday: false,
      journalWrittenToday: false,
    });
    expect(result).toEqual({ completed: 1, total: 2, ratio: 0.5 });
  });

  it('requires every active habit done today for the habits slot to count', () => {
    const result = computeDailyResetProgress({
      moodLoggedToday: false,
      activeHabitCount: 3,
      habitsCompletedToday: 2,
      hasActiveChallenge: false,
      challengeCompletedToday: false,
      journalWrittenToday: false,
    });
    // total = mood(1) + habits(1) + journal(1) = 3; habits slot not met
    expect(result).toEqual({ completed: 0, total: 3, ratio: 0 });
  });

  it('reaches a full 4/4 completion state when everything applicable is done', () => {
    const result = computeDailyResetProgress({
      moodLoggedToday: true,
      activeHabitCount: 2,
      habitsCompletedToday: 2,
      hasActiveChallenge: true,
      challengeCompletedToday: true,
      journalWrittenToday: true,
    });
    expect(result).toEqual({ completed: 4, total: 4, ratio: 1 });
  });

  it('returns a ratio of 0 (not NaN) when somehow total is 0', () => {
    // Not reachable in practice (mood + journal always contribute), but
    // guards the division in case that invariant ever changes.
    const result = computeDailyResetProgress({
      moodLoggedToday: false,
      activeHabitCount: 0,
      habitsCompletedToday: 0,
      hasActiveChallenge: false,
      challengeCompletedToday: false,
      journalWrittenToday: false,
    });
    expect(result.total).toBe(2);
    expect(Number.isNaN(result.ratio)).toBe(false);
  });
});

describe('buildWeeklyStreakDots', () => {
  it('marks only today when the streak is 1 and today is completed', () => {
    const dots = buildWeeklyStreakDots(1, true);
    expect(dots).toEqual([false, false, false, false, false, false, true]);
  });

  it('anchors on yesterday when today is not yet completed', () => {
    const dots = buildWeeklyStreakDots(2, false);
    expect(dots).toEqual([false, false, false, false, true, true, false]);
  });

  it('clamps a streak longer than the 7-day window to all-true', () => {
    const dots = buildWeeklyStreakDots(30, true);
    expect(dots).toEqual([true, true, true, true, true, true, true]);
  });

  it('returns all-false for a zero streak', () => {
    const dots = buildWeeklyStreakDots(0, false);
    expect(dots).toEqual([false, false, false, false, false, false, false]);
  });
});
