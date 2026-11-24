import { getUserTier, tarotReadingsById, dailyTarotByUserDate, tarotFollowupEvents } from '../data/store';
import { SpreadType } from '../types/tarot';
import { getSpread } from './spreads';

// Tarot access: free accounts get ONE card a day - the Daily Card (see GET /tarot/daily; the "One-card reading" tile
// and "See my card" are the same thing). Every other reading (any spread, Yes/No, General guidance...) is Premium, and
// Premium accounts can run up to PREMIUM_DAILY_READING_LIMIT readings a day on top of the daily card.
const PREMIUM_DAILY_READING_LIMIT = Number(process.env.TAROT_PREMIUM_DAILY_READINGS ?? 10);
// Follow-up questions are premium-only. PREMIUM_FOLLOWUP_DAILY_LIMIT is a
// configurable server-side cap (not per-reading) so a premium user can't
// run unbounded AI cost through one reading's follow-up thread - easy to
// tune without touching any route/UI code.
const PREMIUM_FOLLOWUP_DAILY_LIMIT = 20;

/** All entitlement checks run server-side against the stored plan - the client
 * never determines its own premium access. */
export function isSpreadAllowed(userId: string, spreadType: SpreadType): { allowed: boolean; reason?: string } {
  const spread = getSpread(spreadType);
  if (!spread.available) return { allowed: false, reason: 'This spread is not available yet.' };

  const tier = getUserTier(userId);
  if (spread.premium && tier !== 'premium') {
    return { allowed: false, reason: 'This spread requires Palm Setu Premium.' };
  }
  return { allowed: true };
}

export function checkDailyReadingLimit(userId: string): { allowed: boolean; reason?: string; code?: 'PREMIUM_REQUIRED' | 'DAILY_LIMIT_REACHED'; remainingToday?: number } {
  const tier = getUserTier(userId);
  if (tier !== 'premium') {
    return { allowed: false, reason: 'Your free card is the Daily Card. Tarot readings need Palm Setu Premium.', code: 'PREMIUM_REQUIRED', remainingToday: 0 };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // The daily card is a separate, always-free entitlement and never counts against the Premium limit.
  const dailyReadingIds = new Set([...dailyTarotByUserDate.values()].map((d) => d.readingId));

  const readingsToday = [...tarotReadingsById.values()].filter(
    (r) => r.userId === userId && !dailyReadingIds.has(r.id) && new Date(r.createdAt) >= todayStart
  ).length;

  if (readingsToday >= PREMIUM_DAILY_READING_LIMIT) {
    return { allowed: false, reason: `You've done today's ${PREMIUM_DAILY_READING_LIMIT} tarot readings. Come back tomorrow for more.`, code: 'DAILY_LIMIT_REACHED', remainingToday: 0 };
  }
  return { allowed: true, remainingToday: PREMIUM_DAILY_READING_LIMIT - readingsToday };
}

/** Follow-up questions are premium-only. Free-tier users are rejected
 * outright regardless of how many they've asked - there is no free
 * allowance any more. Premium users get a configurable daily cap (counted
 * from real tarotFollowupEvents records since local midnight, same
 * "count real timestamped records" approach as checkDailyReadingLimit),
 * never an unbounded AI cost surface. */
export function checkFollowupLimit(userId: string): { allowed: boolean; reason?: string; code?: 'PREMIUM_REQUIRED' | 'DAILY_LIMIT_REACHED'; remainingToday?: number } {
  const tier = getUserTier(userId);
  if (tier !== 'premium') {
    return { allowed: false, reason: 'Follow-up questions require Palm Setu Premium.', code: 'PREMIUM_REQUIRED' };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const askedToday = tarotFollowupEvents.filter((e) => e.userId === userId && new Date(e.createdAt) >= todayStart).length;

  if (askedToday >= PREMIUM_FOLLOWUP_DAILY_LIMIT) {
    return { allowed: false, reason: `You've reached today's limit of ${PREMIUM_FOLLOWUP_DAILY_LIMIT} follow-up questions. Try again tomorrow.`, code: 'DAILY_LIMIT_REACHED', remainingToday: 0 };
  }
  return { allowed: true, remainingToday: PREMIUM_FOLLOWUP_DAILY_LIMIT - askedToday - 1 };
}
