/**
 * Daily palmistry guidance - deterministic, zero AI calls, grounded only in
 * the user's already-saved palm reading. This intentionally does NOT call
 * any AI provider: palm lines do not change daily, so there is nothing new
 * to "detect" each day, only a different angle on the same already-
 * verified features to reflect on. Generating this without an AI call also
 * means it carries zero marginal API cost regardless of how often users
 * open it.
 *
 * Caching: exactly one guidance object per user per local calendar date,
 * mirroring the idempotency-key pattern in astrology/horoscopeService.ts
 * (`${userId}:${localDate}`) - the caller (routes/palm.ts) is responsible
 * for checking the cache before calling into this module, same as
 * routes/astrology.ts does for dailyHoroscopesByKey.
 */
import { DailyPalmGuidance, PalmReading } from '../types/palm';

const THEMES = [
  'Steadiness', 'Openness', 'Focus', 'Curiosity', 'Rest and recovery', 'Connection', 'Follow-through',
];

// Purely for entertainment framing, explicitly labeled as such wherever it
// is surfaced - never presented as a prediction of any real-world outcome.
const LUCKY_COLORS = ['teal', 'amber', 'sage green', 'slate blue', 'terracotta', 'lavender', 'warm gray'];

function dailySeed(localDate: string): number {
  let hash = 0;
  for (const ch of localDate) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function pick<T>(arr: T[], seed: number, salt: number): T {
  return arr[(seed + salt) % arr.length];
}

/** Picks a deterministic "feature of the day" from the user's already-
 * detected, matched features, so the guidance text can ground itself in
 * something real rather than inventing anything new. */
function featureOfTheDay(reading: PalmReading, seed: number): { title: string; text: string } | null {
  const candidates = reading.freeReading.sections;
  if (candidates.length === 0) return null;
  const chosen = pick(candidates, seed, 0);
  return { title: chosen.title, text: chosen.text };
}

export function generateDailyGuidance(
  userId: string,
  localDate: string,
  reading: PalmReading,
): Omit<DailyPalmGuidance, 'createdAt'> {
  const seed = dailySeed(localDate);
  const theme = pick(THEMES, seed, 1);
  const feature = featureOfTheDay(reading, seed);
  const groundingNote = feature
    ? `Grounded in your own reading: ${feature.title}.`
    : 'Your saved reading did not have a confidently matched feature to ground today\'s prompt in, so this stays general.';

  return {
    userId,
    localDate,
    readingId: reading.id,
    dailyTheme: theme,
    career: feature
      ? `At work today, let "${theme.toLowerCase()}" guide one decision - it connects naturally with what your reading noted: ${feature.text}`
      : `At work today, try bringing a bit more ${theme.toLowerCase()} into one task.`,
    relationship: `In a relationship today, ${theme.toLowerCase()} is worth extending to one person specifically - not as an abstract ideal, but as one concrete small gesture.`,
    personalDevelopment: `Personal growth prompt: where did ${theme.toLowerCase()} show up today, and where did its opposite show up instead?`,
    money: 'Money note: this traditional reading does not predict financial outcomes - treat today as a good day for one practical, unglamorous money task rather than a big decision.',
    positiveAction: `Try one small action today that expresses ${theme.toLowerCase()} on purpose, rather than waiting for it to happen naturally.`,
    avoid: 'Avoid treating any part of this guidance as a certainty about how today will go - it is a prompt for attention, not a forecast.',
    reflectiveQuestion: `${groundingNote} Where did that quality show up today, and did you lean into it or away from it?`,
    smallTask: `Write one sentence tonight about where ${theme.toLowerCase()} showed up today.`,
    luckyColor: `${pick(LUCKY_COLORS, seed, 2)} (just for fun - entertainment only, not a prediction)`,
  };
}
