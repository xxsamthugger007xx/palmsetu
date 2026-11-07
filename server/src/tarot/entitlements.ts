import { getUserTier, tarotReadingsById, dailyTarotByUserDate } from '../data/store';
import { SpreadType } from '../types/tarot';
import { getSpread } from './spreads';

const FREE_DAILY_READING_LIMIT = 1; // beyond the free daily card itself
const FREE_FOLLOWUP_LIMIT = 2; // per reading

/** All entitlement checks run server-side against the stored plan - the client
 * never determines its own premium access. */
export function isSpreadAllowed(userId: string, spreadType: SpreadType): { allowed: boolean; reason?: string } {
  const spread = getSpread(spreadType);
  if (!spread.available) return { allowed: false, reason: 'This spread is not available yet.' };

  const tier = getUserTier(userId);
  if (spread.premium && tier !== 'premium') {
    return { allowed: false, reason: 'This spread requires Solune Premium.' };
  }
  return { allowed: true };
}

export function checkDailyReadingLimit(userId: string): { allowed: boolean; reason?: string } {
  const tier = getUserTier(userId);
  if (tier === 'premium') return { allowed: true };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // The free daily tarot card doesn't consume the free "regular reading" quota,
  // it's a separate, always-free entitlement (see DailyTarot records).
  const dailyReadingIds = new Set([...dailyTarotByUserDate.values()].map((d) => d.readingId));

  const readingsToday = [...tarotReadingsById.values()].filter(
    (r) => r.userId === userId && !dailyReadingIds.has(r.id) && new Date(r.createdAt) >= todayStart
  ).length;

  if (readingsToday >= FREE_DAILY_READING_LIMIT) {
    return { allowed: false, reason: `Free plan allows ${FREE_DAILY_READING_LIMIT} reading per day. Upgrade for unlimited readings.` };
  }
  return { allowed: true };
}

export function checkFollowupLimit(userId: string, readingId: string, askedSoFar: number): { allowed: boolean; reason?: string } {
  const tier = getUserTier(userId);
  if (tier === 'premium') return { allowed: true };
  if (askedSoFar >= FREE_FOLLOWUP_LIMIT) {
    return { allowed: false, reason: `Free plan allows ${FREE_FOLLOWUP_LIMIT} follow-up questions per reading. Upgrade for unlimited follow-ups.` };
  }
  return { allowed: true };
}
