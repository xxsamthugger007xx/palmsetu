import { db } from '../data/db';

/**
 * Acquisition, funnel, and retention analytics built entirely on the
 * user_events table (see events/eventTracker.ts) - no fabricated numbers,
 * no attribution SDK (this app has none), no screen-tracking (doesn't
 * exist yet - see User Journey's own stub note). What IS real: every
 * account creation (GUEST_CREATED / USER_REGISTERED) and every feature
 * completion event already recorded, which is enough for genuine
 * acquisition-over-time, activation-funnel, and week-over-week retention
 * numbers - just not channel-level attribution (no UTM/referrer capture
 * exists on the client).
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// --- Acquisition: new accounts per day ---------------------------------------

export interface AcquisitionDay {
  date: string;
  guestSignups: number;
  registeredSignups: number;
}

export function getAcquisitionOverTime(since?: Date, until?: Date): AcquisitionDay[] {
  const clauses = ["eventType IN ('GUEST_CREATED', 'USER_REGISTERED')"];
  const params: string[] = [];
  if (since) { clauses.push('createdAt >= ?'); params.push(since.toISOString()); }
  if (until) { clauses.push('createdAt <= ?'); params.push(until.toISOString()); }
  const rows = db
    .prepare(`SELECT eventType, createdAt FROM user_events WHERE ${clauses.join(' AND ')} ORDER BY createdAt ASC`)
    .all(...params) as { eventType: string; createdAt: string }[];

  const byDay = new Map<string, AcquisitionDay>();
  for (const r of rows) {
    const day = r.createdAt.slice(0, 10);
    const entry = byDay.get(day) ?? { date: day, guestSignups: 0, registeredSignups: 0 };
    if (r.eventType === 'GUEST_CREATED') entry.guestSignups += 1;
    else entry.registeredSignups += 1;
    byDay.set(day, entry);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// --- Funnels: ever-reached-this-step, by distinct user ------------------------

export interface FunnelStepResult {
  key: string;
  label: string;
  distinctUsers: number;
  conversionFromPrevious: number | null; // fraction, null for the first step
  conversionFromFirst: number;
}

export interface FunnelDefinition {
  key: string;
  label: string;
  steps: { key: string; label: string; eventTypes: string[] }[];
}

export const FUNNEL_DEFINITIONS: FunnelDefinition[] = [
  {
    key: 'activation',
    label: 'Activation: signup → first reading → purchase',
    steps: [
      { key: 'signup', label: 'Account created', eventTypes: ['GUEST_CREATED', 'USER_REGISTERED'] },
      { key: 'first_reading', label: 'Completed a reading', eventTypes: ['PALM_REPORT_GENERATED', 'TAROT_READING_COMPLETED', 'DAILY_CARD_REVEALED'] },
      { key: 'purchase', label: 'Made a purchase', eventTypes: ['PURCHASE_SUCCESS'] },
    ],
  },
  {
    key: 'soulmate',
    label: 'Soulmate Sketch: viewed → questionnaire → paid → completed',
    steps: [
      { key: 'viewed', label: 'Viewed intro', eventTypes: ['page_viewed'] },
      { key: 'questionnaire', label: 'Started questionnaire', eventTypes: ['questionnaire_started'] },
      { key: 'paid', label: 'Payment attempted', eventTypes: ['payment_attempted'] },
      { key: 'completed', label: 'Sketch completed', eventTypes: ['generation_completed'] },
    ],
  },
];

function distinctUsersForEventTypes(eventTypes: string[], since?: Date, until?: Date): Set<string> {
  const placeholders = eventTypes.map(() => '?').join(',');
  const clauses = [`eventType IN (${placeholders})`, 'userId IS NOT NULL'];
  const params: string[] = [...eventTypes];
  if (since) { clauses.push('createdAt >= ?'); params.push(since.toISOString()); }
  if (until) { clauses.push('createdAt <= ?'); params.push(until.toISOString()); }
  const rows = db
    .prepare(`SELECT DISTINCT userId FROM user_events WHERE ${clauses.join(' AND ')}`)
    .all(...params) as { userId: string }[];
  return new Set(rows.map((r) => r.userId));
}

/** Soulmate-specific events live in soulmateAnalyticsEvents (log table), not user_events - see
 * soulmate/analytics.ts. Funnel steps for the 'soulmate' funnel read from there instead. */
function distinctUsersForSoulmateEventTypes(eventTypes: string[], since?: Date, until?: Date): Set<string> {
  const placeholders = eventTypes.map(() => '?').join(',');
  const clauses: string[] = [];
  const params: string[] = [...eventTypes];
  const where = (col: string) => {
    const c = [`json_extract(value, '$.type') IN (${placeholders})`];
    if (since) { c.push(`${col} >= ?`); params.push(since.toISOString()); }
    if (until) { c.push(`${col} <= ?`); params.push(until.toISOString()); }
    return c.join(' AND ');
  };
  const rows = db
    .prepare(`SELECT DISTINCT userId FROM log_soulmateAnalyticsEvents WHERE ${where('createdAt')} AND userId IS NOT NULL`)
    .all(...params) as { userId: string }[];
  void clauses;
  return new Set(rows.map((r) => r.userId));
}

export function getFunnel(funnelKey: string, since?: Date, until?: Date): FunnelStepResult[] | null {
  const def = FUNNEL_DEFINITIONS.find((f) => f.key === funnelKey);
  if (!def) return null;

  const isSoulmate = funnelKey === 'soulmate';
  let runningSet: Set<string> | null = null;
  let firstCount = 0;
  const results: FunnelStepResult[] = [];

  def.steps.forEach((step, i) => {
    const stepUsers = isSoulmate
      ? distinctUsersForSoulmateEventTypes(step.eventTypes, since, until)
      : distinctUsersForEventTypes(step.eventTypes, since, until);
    const narrowed = runningSet ? new Set([...stepUsers].filter((u) => runningSet!.has(u))) : stepUsers;
    const distinctUsers = narrowed.size;
    if (i === 0) firstCount = distinctUsers;
    const previousCount = results[i - 1]?.distinctUsers ?? null;
    results.push({
      key: step.key,
      label: step.label,
      distinctUsers,
      conversionFromPrevious: previousCount != null && previousCount > 0 ? distinctUsers / previousCount : previousCount === 0 ? 0 : null,
      conversionFromFirst: firstCount > 0 ? distinctUsers / firstCount : 0,
    });
    runningSet = narrowed;
  });

  return results;
}

// --- Retention: weekly cohorts --------------------------------------------------

export interface RetentionCohort {
  cohortWeekStart: string;
  cohortSize: number;
  /** Index 0 = the cohort's own signup week (always 100%); index 1 = one week later, etc. */
  retainedPercentByWeekOffset: (number | null)[];
}

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Cohorts users by the ISO week of their first GUEST_CREATED/USER_REGISTERED event, then for each of the
 * following `weekOffsets` weeks, what fraction of that cohort produced ANY event (any type) during that week.
 * Only ever computed from real user_events rows - a cohort/offset with zero data shows null, not a fabricated 0%. */
export function getRetentionCohorts(weekOffsets = 5, maxCohorts = 8): RetentionCohort[] {
  const signupRows = db
    .prepare(`SELECT userId, MIN(createdAt) as firstAt FROM user_events WHERE eventType IN ('GUEST_CREATED', 'USER_REGISTERED') AND userId IS NOT NULL GROUP BY userId`)
    .all() as { userId: string; firstAt: string }[];

  const cohortByWeek = new Map<string, string[]>();
  for (const r of signupRows) {
    const week = isoDate(startOfIsoWeek(new Date(r.firstAt)));
    const arr = cohortByWeek.get(week) ?? [];
    arr.push(r.userId);
    cohortByWeek.set(week, arr);
  }

  const allEventRows = db.prepare(`SELECT userId, createdAt FROM user_events WHERE userId IS NOT NULL`).all() as { userId: string; createdAt: string }[];
  const eventWeeksByUser = new Map<string, Set<string>>();
  for (const r of allEventRows) {
    const week = isoDate(startOfIsoWeek(new Date(r.createdAt)));
    const set = eventWeeksByUser.get(r.userId) ?? new Set<string>();
    set.add(week);
    eventWeeksByUser.set(r.userId, set);
  }

  const cohortWeeks = [...cohortByWeek.keys()].sort().slice(-maxCohorts);

  return cohortWeeks.map((weekStart) => {
    const users = cohortByWeek.get(weekStart)!;
    const cohortDate = new Date(`${weekStart}T00:00:00Z`);
    const retainedPercentByWeekOffset: (number | null)[] = [];
    for (let offset = 0; offset < weekOffsets; offset++) {
      const targetWeek = isoDate(new Date(cohortDate.getTime() + offset * 7 * 24 * 60 * 60 * 1000));
      // Never claim retention for a future week that hasn't happened yet.
      if (new Date(`${targetWeek}T00:00:00Z`).getTime() > Date.now()) {
        retainedPercentByWeekOffset.push(null);
        continue;
      }
      const activeCount = users.filter((u) => eventWeeksByUser.get(u)?.has(targetWeek)).length;
      retainedPercentByWeekOffset.push(users.length ? Math.round((activeCount / users.length) * 1000) / 10 : null);
    }
    return { cohortWeekStart: weekStart, cohortSize: users.length, retainedPercentByWeekOffset };
  });
}
