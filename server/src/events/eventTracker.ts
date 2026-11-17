import crypto from 'crypto';
import { db } from '../data/db';

/**
 * Central event tracking (user_events table, see data/db.ts). This is the
 * one place every feature should call to record a business event, instead
 * of each feature inventing its own analytics log - WellnessAnalyticsEvent
 * and SoulmateAnalyticsEvent predate this and still exist separately (not
 * migrated in this pass, to avoid touching their existing call sites and
 * any code that reads them), but every *new* instrumentation point should
 * write here so the admin panel's Live Activity feed, and any future
 * funnel/cohort/retention analytics, have one consistent source of truth.
 *
 * Deliberately NOT a queue/stream - this is a synchronous SQLite insert,
 * consistent with the rest of this app's persistence model. At Palm Setu's
 * current scale that is fine; if event volume ever becomes a bottleneck,
 * batching writes would be the first thing to change here, not the schema.
 */

export type EventStatus = 'success' | 'failure' | 'pending';

export interface RecordEventInput {
  userId: string | null;
  eventType: string;
  feature: string;
  status?: EventStatus;
  requestId?: string;
  /** Set only when the caller's own retry/idempotency logic could otherwise
   * double-record the same real-world event (e.g. a webhook that may be
   * redelivered). Omit for ordinary one-shot events. */
  dedupeKey?: string;
  /** Structured, non-sensitive fields only: ids, enums, counts, booleans.
   * Never free text, prompts, journal content, or anything from the
   * sensitive-data rules elsewhere in this app. Enforced by convention at
   * each call site, same as WellnessAnalyticsEvent.data. */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface UserEvent {
  id: string;
  userId: string | null;
  eventType: string;
  feature: string;
  status: EventStatus;
  requestId: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const stmts = {
  insert: db.prepare(`
    INSERT INTO user_events (id, userId, eventType, feature, status, requestId, dedupeKey, metadata, createdAt)
    VALUES (@id, @userId, @eventType, @feature, @status, @requestId, @dedupeKey, @metadata, @createdAt)
  `),
  byDedupeKey: db.prepare('SELECT id FROM user_events WHERE dedupeKey = ?'),
  count: db.prepare('SELECT COUNT(*) as c FROM user_events'),
};

/**
 * Records one event. Returns the event id, or the id of the already-
 * existing row if `dedupeKey` collided with a prior call (idempotent).
 */
export function recordEvent(input: RecordEventInput): string {
  if (input.dedupeKey) {
    const existing = stmts.byDedupeKey.get(input.dedupeKey) as { id: string } | undefined;
    if (existing) return existing.id;
  }

  const id = crypto.randomUUID();
  try {
    stmts.insert.run({
      id,
      userId: input.userId,
      eventType: input.eventType,
      feature: input.feature,
      status: input.status ?? 'success',
      requestId: input.requestId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    // A UNIQUE constraint race on dedupeKey (two near-simultaneous retries)
    // is not an error - the event is recorded either way.
    if (input.dedupeKey && String(err?.message).includes('UNIQUE constraint failed')) {
      const row = stmts.byDedupeKey.get(input.dedupeKey) as { id: string } | undefined;
      if (row) return row.id;
    }
    throw err;
  }
  return id;
}

export interface EventFilter {
  userId?: string;
  eventType?: string;
  feature?: string;
  status?: EventStatus;
  since?: Date;
  until?: Date;
  /** Only events with id/createdAt strictly after this cursor - used by the
   * Live Activity feed's polling to fetch only what's new. */
  afterId?: string;
}

function rowToEvent(row: any): UserEvent {
  return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null };
}

export function listEvents(filter: EventFilter, page: number, pageSize: number): { total: number; entries: UserEvent[] } {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.userId) { where.push('userId = ?'); params.push(filter.userId); }
  if (filter.eventType) { where.push('eventType = ?'); params.push(filter.eventType); }
  if (filter.feature) { where.push('feature = ?'); params.push(filter.feature); }
  if (filter.status) { where.push('status = ?'); params.push(filter.status); }
  if (filter.since) { where.push('createdAt >= ?'); params.push(filter.since.toISOString()); }
  if (filter.until) { where.push('createdAt <= ?'); params.push(filter.until.toISOString()); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as c FROM user_events ${whereSql}`).get(...params) as { c: number }).c;
  const rows = db
    .prepare(`SELECT * FROM user_events ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as any[];
  return { total, entries: rows.map(rowToEvent) };
}

/** For the Live Activity feed: events newer than `afterCreatedAt`, oldest-first so the UI can append in order. */
export function listEventsSince(afterCreatedAt: string | null, limit: number): UserEvent[] {
  const rows = afterCreatedAt
    ? db.prepare('SELECT * FROM user_events WHERE createdAt > ? ORDER BY createdAt ASC LIMIT ?').all(afterCreatedAt, limit)
    : db.prepare('SELECT * FROM user_events ORDER BY createdAt DESC LIMIT ?').all(limit).reverse();
  return (rows as any[]).map(rowToEvent);
}

export function eventCount(): number {
  return (stmts.count.get() as { c: number }).c;
}
