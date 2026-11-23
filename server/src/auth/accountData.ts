import { db } from '../data/db';
import {
  readingsById, moodCheckIns, tarotFollowupEvents, assistantUsageLog, wellnessAnalyticsEvents, soulmateAnalyticsEvents,
} from '../data/store';
import { deleteReadingImage } from '../palmistry/imageStorage';

/**
 * Everything the app stores about one user, found generically instead of by a hand-maintained list (the old
 * deletion routine listed 7 stores and silently left journals, mood, habits, chats and more behind).
 *
 * A user's rows are found in every table by (a) the denormalized userId column, (b) the row key being the user id
 * or starting with `<userId>:` (composite keys like "<userId>:<date>"), and (c) the user id appearing quoted in the
 * JSON value (records that reference the user, e.g. relationship rows). User ids are random UUIDs, so (c) cannot
 * match another user's data by accident.
 *
 * Deliberately NOT touched: the admin audit log (accountability record) and `transactions` (payment records
 * businesses are generally required to keep). Admin tables are not user data.
 */
const KEEP_TABLES = new Set(['log_adminAuditLog', 'log_transactions']);
const ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/;

type Col = { name: string };

function userTables(): { table: string; hasValue: boolean; hasKey: boolean; hasUserId: boolean }[] {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  const out: { table: string; hasValue: boolean; hasKey: boolean; hasUserId: boolean }[] = [];
  for (const { name } of names) {
    if (KEEP_TABLES.has(name) || name.startsWith('sqlite_') || name.startsWith('admin_') || name.startsWith('user_readings_fts_')) continue;
    const isApp = name.startsWith('kv_') || name.startsWith('log_') ||
      ['user_events', 'user_facts', 'user_readings', 'user_readings_fts', 'user_sessions', 'memory_retrieval_log', 'user_psu_ids'].includes(name);
    if (!isApp) continue;
    const cols = (db.prepare(`PRAGMA table_info(${name})`).all() as Col[]).map((c) => c.name);
    out.push({ table: name, hasValue: cols.includes('value'), hasKey: cols.includes('key'), hasUserId: cols.includes('userId') });
  }
  return out;
}

function whereFor(t: { hasValue: boolean; hasKey: boolean; hasUserId: boolean; table: string }): { sql: string; paramsFor: (uid: string) => unknown[] } | null {
  const parts: string[] = [];
  const params: ((uid: string) => unknown)[] = [];
  if (t.hasUserId) { parts.push('userId = ?'); params.push((u) => u); }
  if (t.hasKey) { parts.push('key = ?'); params.push((u) => u); parts.push("key LIKE ? ESCAPE '\\'"); params.push((u) => `${u}:%`); }
  if (t.hasValue) { parts.push("value LIKE ? ESCAPE '\\'"); params.push((u) => `%"${u}"%`); }
  if (t.table === 'user_psu_ids') { parts.length = 0; params.length = 0; parts.push('uuid = ?'); params.push((u) => u); }
  if (parts.length === 0) return null;
  return { sql: parts.join(' OR '), paramsFor: (uid) => params.map((f) => f(uid)) };
}

function assertId(userId: string) {
  if (!ID_PATTERN.test(userId)) throw new Error('refusing to process an unexpected user id');
}

/** Permanently deletes all of a user's data (database rows, in-memory log copies, stored palm photos). */
export function deleteAllUserData(userId: string): Record<string, number> {
  assertId(userId);
  const removed: Record<string, number> = {};

  for (const r of readingsById.valuesForUser(userId)) deleteReadingImage(r.id);

  db.transaction(() => {
    for (const t of userTables()) {
      const w = whereFor(t);
      if (!w) continue;
      const res = db.prepare(`DELETE FROM ${t.table} WHERE ${w.sql}`).run(...w.paramsFor(userId));
      if (res.changes) removed[t.table] = res.changes;
    }
  })();

  // persistentArray logs keep a copy in memory; drop the user's entries there too so they don't linger or reappear.
  for (const arr of [moodCheckIns, tarotFollowupEvents, assistantUsageLog, wellnessAnalyticsEvents, soulmateAnalyticsEvents] as { userId?: string }[][]) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].userId === userId) arr.splice(i, 1);
  }
  return removed;
}

/** Everything stored about the user, for the "download my data" export. Secrets (password hash) are stripped. */
export function exportAllUserData(userId: string): Record<string, unknown[]> {
  assertId(userId);
  const out: Record<string, unknown[]> = {};
  for (const t of userTables()) {
    if (t.table === 'kv_authAttempts' || t.table === 'kv_emailVerifications' || t.table === 'kv_passwordResets' || t.table === 'kv_revokedTokens' || t.table === 'kv_guestSessions') continue;
    const w = whereFor(t);
    if (!w) continue;
    const rows = db.prepare(`SELECT * FROM ${t.table} WHERE ${w.sql}`).all(...w.paramsFor(userId)) as Record<string, any>[];
    if (rows.length === 0) continue;
    out[t.table.replace(/^kv_|^log_/, '')] = rows.map((r) => {
      if (typeof r.value === 'string') {
        try {
          const v = JSON.parse(r.value);
          if (v && typeof v === 'object') { delete v.passwordHash; delete v.mfaSecret; }
          return v;
        } catch { /* fall through */ }
      }
      const { value: _v, ...rest } = r;
      return rest;
    });
  }
  return out;
}
