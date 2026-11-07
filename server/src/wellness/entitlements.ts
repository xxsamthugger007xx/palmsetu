import { getUserTier } from '../data/store';
import { BreathingTechnique } from '../types/wellness';

/**
 * Every free/premium threshold for the Wellness module, centralized here -
 * same precedent/reasoning as server/src/tarot/entitlements.ts
 * (FREE_DAILY_READING_LIMIT, FREE_FOLLOWUP_LIMIT): one documented file,
 * never scattered constants across route handlers.
 */

/** Mood tracker: logging itself is unlimited and free (never charge for a
 * user's own basic logging). Only the HISTORY WINDOW returned to a free-tier
 * request is limited - the underlying entries are never deleted or hidden
 * from storage, only from what a free request gets back. Mirrors the
 * gemstone/vastu MAX_*_FREE "limited window of real data" pattern. */
export const MOOD_FREE_HISTORY_DAYS = 7;

/** Habits: free tier may have at most this many ACTIVE (non-archived) habits
 * at once, enforced server-side on creation. */
export const MAX_FREE_HABITS = 3;

/** Challenges: free tier can join these challenge ids; all others require
 * premium. Judgment call: one 7-day challenge of each "flavor" (gratitude,
 * mindfulness) stays free as a taste of the feature; the sleep one and all
 * 21-day commitments are premium since they ask for a bigger commitment. */
export const FREE_CHALLENGE_IDS = ['7-day-gratitude', '7-day-mindfulness'];

/** Breathing: box and deep breathing are free - both are simple, need no
 * guided voice-over or special instruction to be useful standalone. 4-7-8,
 * relaxation, focus and short-mindfulness are premium - they benefit more
 * from guided framing/context, which is where premium value lives. */
export const FREE_BREATHING_TECHNIQUES: BreathingTechnique[] = ['box', 'deep'];

/** Journal base functionality (unlimited entries, CRUD, search, streaks) is
 * ALWAYS free, per explicit "never charge for a user's own basic journal
 * functionality" instruction. Only these two things are premium: */
export const JOURNAL_FREE_PROMPT_CATEGORIES: string[] = ['daily', 'gratitude', 'free-writing'];
/** Free tier gets this many AI-powered journal insight calls (summary/
 * reflective-questions/theme-identification/writing-suggestions) per day,
 * regardless of consent - consent gates whether the call can run at all,
 * this gates how many times a free user can run it. */
export const FREE_JOURNAL_AI_DAILY_LIMIT = 2;

/** Meditation/sleep catalogue: 2-3 entries per category are free, rest premium.
 * Chosen so every category has at least a taste available for free. */
export const FREE_MEDITATION_PER_CATEGORY = 2;

/** Daily Inspiration is entirely free per explicit instruction - no limit
 * constant needed, but the no-repeat lookback window is centralized here. */
export const INSPIRATION_NO_REPEAT_DAYS = 14;

/** AI Wellness Companion usage caps - same centralized-constant precedent as
 * tarot/entitlements.ts FREE_FOLLOWUP_LIMIT, since no admin-configurable
 * limits infrastructure exists anywhere in this app yet. */
export const FREE_AI_COMPANION_DAILY_MESSAGES = 15;
export const PREMIUM_AI_COMPANION_DAILY_MESSAGES = 200; // generous ceiling, not truly "unlimited" to bound AI spend

export function isHabitLimitReached(userId: string, activeHabitCount: number): boolean {
  if (getUserTier(userId) === 'premium') return false;
  return activeHabitCount >= MAX_FREE_HABITS;
}

export function isChallengeAllowed(userId: string, challengeId: string): boolean {
  if (getUserTier(userId) === 'premium') return true;
  return FREE_CHALLENGE_IDS.includes(challengeId);
}

export function isBreathingTechniqueAllowed(userId: string, technique: BreathingTechnique): boolean {
  if (getUserTier(userId) === 'premium') return true;
  return FREE_BREATHING_TECHNIQUES.includes(technique);
}

export function moodHistoryWindowDays(userId: string): number | null {
  // null means "no limit" (premium).
  return getUserTier(userId) === 'premium' ? null : MOOD_FREE_HISTORY_DAYS;
}
