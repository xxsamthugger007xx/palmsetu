import { v4 as uuid } from 'uuid';
import { soulmateAnalyticsEvents, SoulmateAnalyticsEvent } from '../data/store';

/** Single write path for Soulmate Sketch analytics events, same precedent
 * as recordWellnessEvent (wellness/analytics.ts) - called only at genuine
 * points in the real flow, never fabricated or called speculatively.
 * `data` is restricted to string/number/boolean so nothing sensitive (full
 * questionnaire free-text, payment secrets) ever ends up in an analytics
 * row. */
export function recordSoulmateEvent(
  userId: string,
  type: SoulmateAnalyticsEvent['type'],
  data: Record<string, string | number | boolean> = {}
): void {
  soulmateAnalyticsEvents.push({
    id: uuid(),
    userId,
    type,
    createdAt: new Date().toISOString(),
    data,
  });
}
