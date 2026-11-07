import { v4 as uuid } from 'uuid';
import { db } from '../data/db';
import { AssistantFeature } from '../data/store';

/**
 * Structured, persistent user memory (Priority 2/3/4 of the memory system).
 * These tables are separate from the per-feature stores in data/store.ts:
 * each row here is a *compact summary* referencing an original record by
 * `sourceId`, never a duplicate of the full report. This keeps retrieval
 * cheap and, critically, means a free user's memory of a reading they took
 * while briefly premium can never leak the full premium content back out
 * (see premium-safe retrieval below) - only the summary saved here is ever
 * surfaced to the assistant.
 */
export type ReadingStatus = 'completed' | 'failed';

export interface UserReadingMemory {
  id: string;
  userId: string;
  feature: AssistantFeature;
  status: ReadingStatus;
  tier: 'free' | 'premium';
  sourceId: string;
  summary: string; // compact human-readable facts only, never raw report text
  createdAt: string;
}

const insertReadingStmt = db.prepare(`
  INSERT INTO user_readings (id, userId, feature, status, tier, sourceId, summary, createdAt)
  VALUES (@id, @userId, @feature, @status, @tier, @sourceId, @summary, @createdAt)
`);
const insertFtsStmt = db.prepare(`
  INSERT INTO user_readings_fts (id, userId, feature, summary) VALUES (?, ?, ?, ?)
`);
const deleteFtsStmt = db.prepare(`DELETE FROM user_readings_fts WHERE id = ?`);
const softDeleteStmt = db.prepare(`UPDATE user_readings SET deletedAt = ? WHERE id = ? AND userId = ?`);
const softDeleteAllStmt = db.prepare(`UPDATE user_readings SET deletedAt = ? WHERE userId = ? AND deletedAt IS NULL`);
const listByUserStmt = db.prepare(`
  SELECT * FROM user_readings WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT ?
`);
const listByUserFeatureStmt = db.prepare(`
  SELECT * FROM user_readings WHERE userId = ? AND feature = ? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT ?
`);
const keywordSearchStmt = db.prepare(`
  SELECT ur.* FROM user_readings ur
  JOIN user_readings_fts fts ON fts.id = ur.id
  WHERE ur.userId = ? AND ur.deletedAt IS NULL AND fts.summary MATCH ?
  ORDER BY ur.createdAt DESC LIMIT ?
`);
const findBySourceStmt = db.prepare(`SELECT * FROM user_readings WHERE sourceId = ? AND userId = ?`);

/**
 * Called exactly once per genuinely-completed reading/report/scan, from the
 * feature route's actual completion point (never on draw/start, never on a
 * failed generation - see each route's call site for why that point is
 * "genuine completion" for that feature). Never blocks the user-facing
 * response: callers call this synchronously right after writing the real
 * record, but it is a single cheap INSERT (sub-millisecond on SQLite), not
 * an AI call, so it never meaningfully delays anything.
 */
export function recordCompletedReading(
  userId: string,
  feature: AssistantFeature,
  sourceId: string,
  tier: 'free' | 'premium',
  summary: string,
): UserReadingMemory | null {
  // Never store a duplicate memory for the same underlying record.
  const existing = findBySourceStmt.get(sourceId, userId) as UserReadingMemory | undefined;
  if (existing) return existing;

  const row: UserReadingMemory = {
    id: uuid(),
    userId,
    feature,
    status: 'completed',
    tier,
    sourceId,
    summary,
    createdAt: new Date().toISOString(),
  };
  insertReadingStmt.run(row);
  insertFtsStmt.run(row.id, row.userId, row.feature, row.summary);
  return row;
}

export function listMemoriesForUser(userId: string, limit = 200): UserReadingMemory[] {
  return listByUserStmt.all(userId, limit) as UserReadingMemory[];
}

export function listMemoriesForUserFeature(userId: string, feature: AssistantFeature, limit = 50): UserReadingMemory[] {
  return listByUserFeatureStmt.all(userId, feature, limit) as UserReadingMemory[];
}

/** Deletes one memory record (and its FTS row). Ownership-checked: a userId
 * mismatch is a silent no-op, never an error that reveals another user's
 * record exists. */
export function deleteMemory(userId: string, memoryId: string): boolean {
  const res = softDeleteStmt.run(new Date().toISOString(), memoryId, userId);
  if (res.changes > 0) deleteFtsStmt.run(memoryId);
  return res.changes > 0;
}

export function deleteAllMemoriesForUser(userId: string): number {
  const rows = listByUserStmt.all(userId, 100000) as UserReadingMemory[];
  const res = softDeleteAllStmt.run(new Date().toISOString(), userId);
  for (const r of rows) deleteFtsStmt.run(r.id);
  return res.changes;
}

/**
 * Invalidates the memory record for an original feature record that the
 * user deleted directly (e.g. a tarot journal/reading delete elsewhere).
 * Keeps memory in sync with its source without the memory layer needing to
 * know about every feature's own delete route.
 */
export function invalidateMemoryForSource(userId: string, sourceId: string): void {
  const existing = findBySourceStmt.get(sourceId, userId) as UserReadingMemory | undefined;
  if (existing) deleteMemory(userId, existing.id);
}

// --- Per-user memory on/off setting (Priority 5) ---------------------------
const getSettingStmt = db.prepare(`SELECT value FROM kv_memorySettings WHERE key = ?`);
const setSettingStmt = db.prepare(`
  INSERT INTO kv_memorySettings (key, value, userId, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
`);

export function isMemoryEnabledForUser(userId: string): boolean {
  const row = getSettingStmt.get(userId) as { value: string } | undefined;
  if (!row) return true; // on by default
  return (JSON.parse(row.value) as { enabled: boolean }).enabled;
}

export function setMemoryEnabledForUser(userId: string, enabled: boolean): void {
  setSettingStmt.run(userId, JSON.stringify({ enabled }), userId, new Date().toISOString());
}

// --- Durable fact extraction (Priority 2, conversation_memory) ------------
export interface UserFact {
  id: string;
  userId: string;
  kind: string;
  fact: string;
  sourceConversationId: string | null;
  createdAt: string;
}
const insertFactStmt = db.prepare(`
  INSERT INTO user_facts (id, userId, kind, fact, sourceConversationId, createdAt)
  VALUES (@id, @userId, @kind, @fact, @sourceConversationId, @createdAt)
`);
const listFactsStmt = db.prepare(`SELECT * FROM user_facts WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`);
const factExistsStmt = db.prepare(`SELECT 1 FROM user_facts WHERE userId = ? AND fact = ? LIMIT 1`);

/**
 * Cheap, rule-based extraction of durable facts from a single chat message -
 * deliberately NOT an AI call, per the task's own "never add a mandatory AI
 * call on every message" requirement. Matches a small set of common durable-
 * fact phrasings. Call this fire-and-forget, after the user-facing response
 * has already been sent, never before it.
 */
const FACT_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: 'interest', re: /\bI(?:'m| am) interested in ([^.!?\n]{3,120})/i },
  { kind: 'occupation', re: /\bI work as (?:an? )?([^.!?\n]{3,80})/i },
  { kind: 'goal', re: /\bI want to ([^.!?\n]{3,120})/i },
  { kind: 'preference', re: /\bI (?:prefer|like) ([^.!?\n]{3,120})/i },
];

export function extractAndStoreFacts(userId: string, message: string, conversationId: string | null): UserFact[] {
  if (message.length < 8) return []; // too short to plausibly contain a durable fact
  const found: UserFact[] = [];
  for (const { kind, re } of FACT_PATTERNS) {
    const match = message.match(re);
    if (!match) continue;
    const fact = `${kind}: ${match[1].trim()}`;
    if (factExistsStmt.get(userId, fact)) continue; // don't duplicate the same fact
    const row: UserFact = {
      id: uuid(), userId, kind, fact, sourceConversationId: conversationId, createdAt: new Date().toISOString(),
    };
    insertFactStmt.run(row);
    found.push(row);
  }
  return found;
}

export function listFactsForUser(userId: string, limit = 50): UserFact[] {
  return listFactsStmt.all(userId, limit) as UserFact[];
}

// --- Retrieval ranking (Priority 3) ----------------------------------------
const logRetrievalStmt = db.prepare(`
  INSERT INTO memory_retrieval_log (id, userId, requestedAt, success, recordCount) VALUES (?, ?, ?, ?, ?)
`);

function sanitizeFtsQuery(raw: string): string | null {
  // FTS5 MATCH needs bareword/quoted tokens; strip punctuation and keep
  // alphanumerics so a free-form question never throws a syntax error.
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}*`).join(' OR ');
}

/**
 * Ranked historical memory retrieval for the assistant pipeline. No vector
 * search: SQLite FTS5 keyword matching plus a feature-type filter plus
 * recency ordering is sufficient and far cheaper at this app's scale, and
 * is a plain SQL query (no AI call) so it never adds generation latency.
 * Returns at most `limit` compact summaries - never raw report content.
 */
export function retrieveRelevantMemories(
  userId: string,
  question: string,
  feature: AssistantFeature | null,
  limit = 5,
): UserReadingMemory[] {
  if (!isMemoryEnabledForUser(userId)) {
    logRetrievalStmt.run(uuid(), userId, new Date().toISOString(), 0, 0);
    return [];
  }

  try {
    let results: UserReadingMemory[] = [];
    const ftsQuery = sanitizeFtsQuery(question);
    if (ftsQuery) {
      try {
        results = keywordSearchStmt.all(userId, ftsQuery, limit * 2) as UserReadingMemory[];
      } catch {
        results = []; // malformed FTS query (shouldn't happen given sanitize) - fall through to recency
      }
    }
    if (feature) results = results.filter((r) => r.feature === feature);
    if (results.length === 0) {
      results = feature
        ? (listByUserFeatureStmt.all(userId, feature, limit) as UserReadingMemory[])
        : (listByUserStmt.all(userId, limit) as UserReadingMemory[]);
    }
    const capped = results.slice(0, limit);
    logRetrievalStmt.run(uuid(), userId, new Date().toISOString(), 1, capped.length);
    return capped;
  } catch {
    logRetrievalStmt.run(uuid(), userId, new Date().toISOString(), 0, 0);
    return [];
  }
}

export function memoryAdminStats() {
  const totalReadings = (db.prepare(`SELECT COUNT(*) c FROM user_readings WHERE deletedAt IS NULL`).get() as { c: number }).c;
  const byFeature = db.prepare(`
    SELECT feature, COUNT(*) c FROM user_readings WHERE deletedAt IS NULL GROUP BY feature
  `).all() as { feature: string; c: number }[];
  const totalFacts = (db.prepare(`SELECT COUNT(*) c FROM user_facts`).get() as { c: number }).c;
  const retrievals = db.prepare(`
    SELECT COUNT(*) total, SUM(success) successes FROM memory_retrieval_log
  `).get() as { total: number; successes: number | null };
  const deletions = (db.prepare(`SELECT COUNT(*) c FROM user_readings WHERE deletedAt IS NOT NULL`).get() as { c: number }).c;
  return {
    totalSavedReadings: totalReadings,
    savedReadingsByFeature: byFeature,
    conversationMemoryFactCount: totalFacts,
    memoryRetrievalRequests: retrievals.total,
    memoryRetrievalSuccesses: retrievals.successes ?? 0,
    deletionRequests: deletions,
  };
}
