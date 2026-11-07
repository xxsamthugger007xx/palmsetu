/**
 * Pure, test-covered calculations for the Wellness home screen's "Daily
 * Reset" hero and habit journey strip. Kept out of WellnessScreen.tsx so the
 * real counting logic can be unit tested like the rest of src/utils.
 *
 * "Activities completed today" definition (N = number of trackable daily
 * activities that actually apply to this user today):
 *   1. Mood check-in - counts once the user has a mood entry for today.
 *   2. Habits - counts as ONE combined activity: done once every active
 *      habit has a completion for today. If the user has zero active
 *      habits, this slot is excluded from N entirely (not counted as a
 *      miss) so people who haven't created habits yet aren't punished.
 *   3. Daily challenge - counts once today's day of an active challenge has
 *      been marked complete via complete-day. Excluded from N if the user
 *      has no active challenge.
 *   4. Journal - counts once the user has written at least one journal
 *      entry today.
 * This keeps N honest and personal: a user with no habits and no active
 * challenge simply has N = 2 (mood + journal) rather than a padded N = 4
 * with phantom unmet slots.
 */

export interface DailyResetInputs {
  moodLoggedToday: boolean;
  activeHabitCount: number;
  habitsCompletedToday: number;
  hasActiveChallenge: boolean;
  challengeCompletedToday: boolean;
  journalWrittenToday: boolean;
}

export interface DailyResetProgress {
  completed: number;
  total: number;
  ratio: number; // 0..1, 0 when total is 0
}

export function computeDailyResetProgress(inputs: DailyResetInputs): DailyResetProgress {
  let total = 0;
  let completed = 0;

  // Mood check-in always applies.
  total += 1;
  if (inputs.moodLoggedToday) completed += 1;

  // Habits only count if the user actually has active habits.
  if (inputs.activeHabitCount > 0) {
    total += 1;
    if (inputs.habitsCompletedToday >= inputs.activeHabitCount) completed += 1;
  }

  // Challenge only counts if the user has joined one.
  if (inputs.hasActiveChallenge) {
    total += 1;
    if (inputs.challengeCompletedToday) completed += 1;
  }

  // Journal always applies.
  total += 1;
  if (inputs.journalWrittenToday) completed += 1;

  return { completed, total, ratio: total > 0 ? completed / total : 0 };
}

/**
 * Builds a 7-entry (oldest -> today) boolean strip for a single habit's
 * weekly completion dot display, derived entirely from real server data:
 * the habit's current streak (a contiguous run of completed days ending
 * today or yesterday) and whether it was completed today.
 *
 * This is a conservative, honest reconstruction, not a fabricated history:
 * the server only exposes an aggregate streak count and a 7-day completion
 * count, not which specific non-streak days were completed. So any day
 * inside the streak's contiguous run is marked done; days outside the
 * streak run default to not-done, which may undercount a habit with an
 * earlier gap-then-restart pattern within the same week, but never
 * overstates completion.
 */
export function buildWeeklyStreakDots(currentStreak: number, completedToday: boolean): boolean[] {
  const days = 7;
  const dots = new Array(days).fill(false);
  // Index (days - 1) is today. The streak's anchor day is today if it was
  // completed today, otherwise yesterday (index days - 2) - the same
  // forgiving anchor the server's own streak endpoint uses.
  const anchorIndex = completedToday ? days - 1 : days - 2;
  let remaining = Math.max(0, currentStreak);
  let i = anchorIndex;
  while (remaining > 0 && i >= 0) {
    dots[i] = true;
    remaining -= 1;
    i -= 1;
  }
  return dots;
}
