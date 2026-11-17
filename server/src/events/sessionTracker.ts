import crypto from 'crypto';
import { db } from '../data/db';

/**
 * Real mobile app session tracking (user_sessions table, see data/db.ts).
 * Sessions are created and closed by explicit calls from the Expo app's
 * lifecycle instrumentation (see app/src/services/sessionTracker.ts +
 * App.tsx's AppState wiring) - never derived from login events, which
 * would conflate "signed in" with "actively using the app right now".
 *
 * Honest limitation, stated here once rather than re-litigated at every
 * call site: React Native cannot reliably observe a force-quit/OS-kill.
 * AppState only ever reports 'background'/'inactive' before the process
 * dies, so a clean background (user presses home) is real and explicit,
 * but a hard kill from the OS task switcher never fires another event.
 * INACTIVITY_TIMEOUT_MS below is how the server infers "this session is
 * actually over" for those cases - it is explicitly an inference, and
 * every API response that surfaces it is labeled `durationMeasured: false`
 * so nothing downstream mistakes it for a real measurement.
 */

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes with no event = treat as ended

export interface StartSessionInput {
  userId: string | null;
  device: string | null;
  os: string | null;
  appVersion: string | null;
  entryScreen: string | null;
}

export interface SessionEventInput {
  type: 'screen_view' | 'feature_used' | 'action' | 'error';
  screen?: string;
  feature?: string;
  action?: string;
  error?: string;
}

export interface UserSession {
  id: string;
  userId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  durationMeasured: boolean;
  endReason: string | null;
  device: string | null;
  os: string | null;
  appVersion: string | null;
  entryScreen: string | null;
  exitScreen: string | null;
  featuresVisited: string[];
  actionsCompleted: string[];
  errorCount: number;
  lastEventAt: string;
  createdAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

const stmts = {
  insert: db.prepare(`
    INSERT INTO user_sessions (id, userId, startedAt, device, os, appVersion, entryScreen, featuresVisited, actionsCompleted, lastEventAt, createdAt)
    VALUES (@id, @userId, @startedAt, @device, @os, @appVersion, @entryScreen, '[]', '[]', @lastEventAt, @createdAt)
  `),
  byId: db.prepare('SELECT * FROM user_sessions WHERE id = ?'),
  update: db.prepare(`
    UPDATE user_sessions SET exitScreen = @exitScreen, featuresVisited = @featuresVisited,
      actionsCompleted = @actionsCompleted, errorCount = @errorCount, lastEventAt = @lastEventAt
    WHERE id = @id
  `),
  close: db.prepare(`
    UPDATE user_sessions SET endedAt = @endedAt, durationMs = @durationMs, durationMeasured = @durationMeasured,
      endReason = @endReason, lastEventAt = @lastEventAt
    WHERE id = @id
  `),
  openStale: db.prepare('SELECT * FROM user_sessions WHERE endedAt IS NULL AND lastEventAt < ?'),
};

function rowToSession(row: any): UserSession {
  return {
    ...row,
    durationMeasured: !!row.durationMeasured,
    featuresVisited: JSON.parse(row.featuresVisited),
    actionsCompleted: JSON.parse(row.actionsCompleted),
  };
}

export function startSession(input: StartSessionInput): { sessionId: string; startedAt: string } {
  const id = crypto.randomUUID();
  const startedAt = nowIso();
  stmts.insert.run({
    id,
    userId: input.userId,
    startedAt,
    device: input.device,
    os: input.os,
    appVersion: input.appVersion,
    entryScreen: input.entryScreen,
    lastEventAt: startedAt,
    createdAt: startedAt,
  });
  return { sessionId: id, startedAt };
}

export function recordSessionEvent(sessionId: string, event: SessionEventInput): boolean {
  const row = stmts.byId.get(sessionId) as any;
  if (!row || row.endedAt) return false; // unknown or already-closed session: ignore, don't resurrect

  const featuresVisited: string[] = JSON.parse(row.featuresVisited);
  const actionsCompleted: string[] = JSON.parse(row.actionsCompleted);
  let exitScreen = row.exitScreen;
  let errorCount = row.errorCount;

  if (event.type === 'screen_view' && event.screen) {
    exitScreen = event.screen;
  }
  if (event.type === 'feature_used' && event.feature && !featuresVisited.includes(event.feature)) {
    featuresVisited.push(event.feature);
  }
  if (event.type === 'action' && event.action) {
    actionsCompleted.push(event.action);
  }
  if (event.type === 'error') {
    errorCount += 1;
  }

  stmts.update.run({
    id: sessionId,
    exitScreen,
    featuresVisited: JSON.stringify(featuresVisited),
    actionsCompleted: JSON.stringify(actionsCompleted),
    errorCount,
    lastEventAt: nowIso(),
  });
  return true;
}

export function endSession(sessionId: string, reason: 'background' | 'app_closed'): boolean {
  const row = stmts.byId.get(sessionId) as any;
  if (!row || row.endedAt) return false;
  const endedAt = nowIso();
  const durationMs = new Date(endedAt).getTime() - new Date(row.startedAt).getTime();
  stmts.close.run({ id: sessionId, endedAt, durationMs, durationMeasured: 1, endReason: reason, lastEventAt: endedAt });
  return true;
}

/**
 * Closes any session that has gone quiet for longer than
 * INACTIVITY_TIMEOUT_MS, inferring its end at its last known event rather
 * than now - this is what "handles app termination" in practice, since RN
 * cannot observe a hard kill directly (see module doc comment). Cheap
 * enough to run on every session-list query at this app's scale; call
 * before reading rather than on a background timer, so there is no extra
 * process to keep alive.
 */
export function sweepStaleSessions(): number {
  const cutoff = new Date(Date.now() - INACTIVITY_TIMEOUT_MS).toISOString();
  const stale = stmts.openStale.all(cutoff) as any[];
  for (const row of stale) {
    const durationMs = new Date(row.lastEventAt).getTime() - new Date(row.startedAt).getTime();
    stmts.close.run({ id: row.id, endedAt: row.lastEventAt, durationMs, durationMeasured: 0, endReason: 'timeout_inferred', lastEventAt: row.lastEventAt });
  }
  return stale.length;
}

export function listSessionsForUser(userId: string, page: number, pageSize: number): { total: number; entries: UserSession[] } {
  sweepStaleSessions();
  const total = (db.prepare('SELECT COUNT(*) as c FROM user_sessions WHERE userId = ?').get(userId) as { c: number }).c;
  const rows = db
    .prepare('SELECT * FROM user_sessions WHERE userId = ? ORDER BY startedAt DESC LIMIT ? OFFSET ?')
    .all(userId, pageSize, (page - 1) * pageSize) as any[];
  return { total, entries: rows.map(rowToSession) };
}

export interface UserEngagementStats {
  totalSessions: number;
  averageSessionDurationMs: number | null;
  measuredSessionCount: number;
  estimatedSessionCount: number;
  lastActiveAt: string | null;
  daysActive: number;
}

/** Only ever computed from real session rows for this user - returns nulls/zeros, never invented numbers, when there is no session data yet. */
export function getUserEngagementStats(userId: string): UserEngagementStats {
  sweepStaleSessions();
  const rows = db.prepare('SELECT durationMs, durationMeasured, startedAt FROM user_sessions WHERE userId = ?').all(userId) as any[];
  const withDuration = rows.filter((r) => r.durationMs != null);
  const totalDuration = withDuration.reduce((sum, r) => sum + r.durationMs, 0);
  const lastRow = db.prepare('SELECT lastEventAt FROM user_sessions WHERE userId = ? ORDER BY lastEventAt DESC LIMIT 1').get(userId) as { lastEventAt: string } | undefined;
  const distinctDays = new Set(rows.map((r) => r.startedAt.slice(0, 10)));

  return {
    totalSessions: rows.length,
    averageSessionDurationMs: withDuration.length ? Math.round(totalDuration / withDuration.length) : null,
    measuredSessionCount: rows.filter((r) => r.durationMeasured).length,
    estimatedSessionCount: rows.filter((r) => r.durationMs != null && !r.durationMeasured).length,
    lastActiveAt: lastRow?.lastEventAt ?? null,
    daysActive: distinctDays.size,
  };
}

export function getLatestDeviceInfo(userId: string): { device: string | null; os: string | null; appVersion: string | null } | null {
  const row = db.prepare('SELECT device, os, appVersion FROM user_sessions WHERE userId = ? ORDER BY startedAt DESC LIMIT 1').get(userId) as any;
  return row ?? null;
}
