import { v4 as uuid } from 'uuid';
import { wellnessAnalyticsEvents } from '../data/store';
import { WellnessAnalyticsEventType } from '../types/wellness';

/**
 * Single write path for wellness analytics events, called at genuine
 * completion points from other wellness routes (same precedent as
 * recordCompletedReading elsewhere in this app) - never fabricated, never
 * called speculatively. `data` is deliberately typed to only accept
 * string/number/boolean values (ids, enums, counts, flags) - this is the
 * runtime+type-level guard against ever attaching journal text or raw note
 * content to an analytics event.
 */
export function recordWellnessEvent(
  userId: string,
  type: WellnessAnalyticsEventType,
  data: Record<string, string | number | boolean> = {},
) {
  wellnessAnalyticsEvents.push({
    id: uuid(),
    userId,
    type,
    createdAt: new Date().toISOString(),
    data,
  });
}
