import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * Real, file-based SQLite persistence for the whole app. This is the first
 * genuine database Solune has ever had: everything in store.ts used to live
 * in plain in-memory Maps/arrays and vanished on every restart. SQLite (via
 * better-sqlite3, synchronous, zero extra service to run) was chosen over
 * Postgres because this project has no infrastructure to run/manage a
 * separate DB server, and SQLite is genuinely durable for a single-process
 * app of this size.
 *
 * The DB file lives at server/data/solune.db, is created automatically if
 * missing, and is gitignored (see .gitignore `data/`).
 */
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// In tests, default to a private in-memory database per worker process so
// vitest's parallel test files never contend over the same file lock (and
// never leave test data on disk). Set SOLUNE_DB_PATH explicitly to opt into
// a real file even under NODE_ENV=test (used by the restart-persistence test).
const DB_PATH = process.env.SOLUNE_DB_PATH || (process.env.NODE_ENV === 'test' ? ':memory:' : path.join(DATA_DIR, 'solune.db'));

export const db = new Database(DB_PATH);
if (DB_PATH !== ':memory:') db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Generic key/value tables backing the Map-like stores in store.ts. Each
 * "kv_<name>" table is a simple (key, value JSON, userId, createdAt) table
 * with indexes on userId and createdAt, since those are the real query
 * patterns used by routes and the new memory system. `userId`/`createdAt`
 * are denormalized out of the JSON value at write time purely so they can be
 * indexed/queried without deserializing every row.
 */
function createKvTable(name: string) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_${name} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      userId TEXT,
      createdAt TEXT,
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_kv_${name}_userId ON kv_${name}(userId);
    CREATE INDEX IF NOT EXISTS idx_kv_${name}_createdAt ON kv_${name}(createdAt);
  `);
}

/** Append-only log tables (replace plain arrays like transactions/auditLog). */
function createLogTable(name: string) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS log_${name} (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      userId TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_log_${name}_userId ON log_${name}(userId);
    CREATE INDEX IF NOT EXISTS idx_log_${name}_createdAt ON log_${name}(createdAt);
  `);
}

export function runMigrations() {
  // Mirror every former in-memory store 1:1 as a kv table.
  const kvTables = [
    'readings', 'dailyActivity', 'assistantFreeChat', 'aiMonthlySpend', 'revokedTokens', 'passwordResets', 'conversations', 'tarotReadings', 'tarotJournal', 'dailyTarot',
    'tarotFollowupCounts', 'userPlans', 'birthProfiles', 'dailyHoroscopes',
    'astrologyFollowupCounts', 'partnerInvitations', 'relationships',
    'activeRelationshipByUser', 'relationshipConsents', 'relationshipDailyReports',
    'deliveryPreferences', 'gemstoneReports', 'gemstoneFollowupCounts',
    'vastuProperties', 'vastuReports', 'vastuFollowupCounts',
    'assistantConversations', 'memorySettings',
    'kundliCharts', 'soulEnergyReadings', 'dailyPalmGuidance', 'palmFollowupCounts',
    'palmSectionUnlocks',
    'userIdentities', 'onboardingDrafts',
    // Wellness module (see data/store.ts and types/wellness.ts).
    'moodEntries', 'journalEntries', 'breathingSessions', 'habits', 'habitCompletions',
    'challengeProgress', 'meditationSessions', 'wellnessGoals', 'inspirationHistory',
    'wellnessFavorites', 'wellnessPreferences', 'wellnessAiConversations',
    'discoveryAnswers', 'discoveryQuestionSelections', 'weeklyReports', 'monthlyReports',
    // Auth (see data/store.ts and auth/).
    'accounts', 'guestSessions', 'authAttempts', 'emailVerifications',
    // Soulmate Sketch (see data/store.ts and routes/soulmate.ts).
    'soulmateSketches',
    // Durable runtime config (pricing, AI budget, feature flags, assistant
    // config) - see data/runtimeConfig.ts. Live-editable via admin panel.
    'appConfig',
    // Manually-logged operational incidents (see ops/alertsEngine.ts).
    'incidents',
  ];
  for (const t of kvTables) createKvTable(t);

  const logTables = ['moodCheckIns', 'transactions', 'assistantUsageLog', 'adminAuditLog', 'wellnessAnalyticsEvents', 'soulmateAnalyticsEvents', 'aiUsageEvents', 'tarotFollowupEvents', 'apiRequests'];
  for (const t of logTables) createLogTable(t);

  // New structured memory tables (Priority 2).
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_readings (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      feature TEXT NOT NULL,
      status TEXT NOT NULL,
      tier TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      summary TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_readings_userId ON user_readings(userId);
    CREATE INDEX IF NOT EXISTS idx_user_readings_feature ON user_readings(userId, feature);
    CREATE INDEX IF NOT EXISTS idx_user_readings_createdAt ON user_readings(createdAt);

    CREATE TABLE IF NOT EXISTS user_facts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      kind TEXT NOT NULL,
      fact TEXT NOT NULL,
      sourceConversationId TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_facts_userId ON user_facts(userId);

    CREATE TABLE IF NOT EXISTS memory_retrieval_log (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      requestedAt TEXT NOT NULL,
      success INTEGER NOT NULL,
      recordCount INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_retrieval_log_createdAt ON memory_retrieval_log(requestedAt);
  `);

  // FTS5 index over reading summaries for cheap keyword search (Priority 3).
  // No vector/semantic search: unjustified at this app's scale, plain
  // keyword + feature-type + recency filtering is sufficient and far
  // cheaper, and FTS5 ships inside better-sqlite3's bundled SQLite build.
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS user_readings_fts USING fts5(
      id UNINDEXED, userId UNINDEXED, feature, summary, content=''
    );
  `);

  // --- Super Admin panel (real auth), see auth/adminAuth.ts ----------------
  // Replaces the old single-shared-password/in-memory-session mechanism.
  // Tiny expected row count (a handful of admin staff), so no kv_ wrapper -
  // plain relational tables with real columns, same as user_readings above.
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      mfaSecret TEXT,
      mfaEnabled INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      adminId TEXT NOT NULL REFERENCES admin_users(id),
      tokenHash TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      revokedAt TEXT,
      ip TEXT,
      userAgent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_adminId ON admin_sessions(adminId);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_tokenHash ON admin_sessions(tokenHash);

    CREATE TABLE IF NOT EXISTS admin_login_history (
      id TEXT PRIMARY KEY,
      adminId TEXT,
      email TEXT NOT NULL,
      success INTEGER NOT NULL,
      failureReason TEXT,
      ip TEXT,
      userAgent TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_login_history_createdAt ON admin_login_history(createdAt);
    CREATE INDEX IF NOT EXISTS idx_admin_login_history_adminId ON admin_login_history(adminId);

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      adminId TEXT NOT NULL,
      action TEXT NOT NULL,
      path TEXT NOT NULL,
      targetType TEXT,
      targetId TEXT,
      reason TEXT,
      outcome TEXT NOT NULL DEFAULT 'success',
      metadata TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_createdAt ON admin_audit_log(createdAt);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_log_adminId ON admin_audit_log(adminId);
  `);

  // --- Central event tracking (see events/eventTracker.ts) ----------------
  // One durable row per important business event across every feature,
  // following the WellnessAnalyticsEvent/SoulmateAnalyticsEvent convention
  // already used per-feature, but unified so the admin panel's Live
  // Activity feed and future funnel/cohort analytics have one source of
  // truth instead of needing a special case per feature. `dedupeKey` is
  // optional and unique - set it when a caller's own retry logic could
  // otherwise double-record the same real-world event.
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_events (
      id TEXT PRIMARY KEY,
      userId TEXT,
      eventType TEXT NOT NULL,
      feature TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      requestId TEXT,
      dedupeKey TEXT UNIQUE,
      metadata TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_events_userId ON user_events(userId);
    CREATE INDEX IF NOT EXISTS idx_user_events_eventType ON user_events(eventType);
    CREATE INDEX IF NOT EXISTS idx_user_events_feature ON user_events(feature);
    CREATE INDEX IF NOT EXISTS idx_user_events_createdAt ON user_events(createdAt);
  `);

  // --- Palm Setu User ID (PSU-000001 style), see auth/psuId.ts -------------
  // `seq` is the SQLite-native AUTOINCREMENT integer: concurrency-safe
  // because better-sqlite3 is synchronous and this process is single-
  // threaded (same assumption the rest of this file already relies on), so
  // two "new user" requests can never interleave mid-assignment.
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_psu_ids (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      psuId TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );
  `);

  // --- Mobile app session tracking (see events/sessionTracker.ts) ---------
  // One row per real app session, started/updated/ended by explicit calls
  // from the Expo app's lifecycle instrumentation (App.tsx + AppState) -
  // NOT derived from login events, per the Phase 2 requirement. `endReason`
  // is 'background' | 'terminated_inferred' | 'timeout_inferred' | null
  // (still open). `durationMeasured` is 0/1: 1 only when the client itself
  // sent an explicit end call; a session that goes quiet and is later
  // closed by the server's inactivity sweep has durationMeasured = 0, its
  // duration is an estimate against lastEventAt, never presented as exact.
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      startedAt TEXT NOT NULL,
      endedAt TEXT,
      durationMs INTEGER,
      durationMeasured INTEGER NOT NULL DEFAULT 0,
      endReason TEXT,
      device TEXT,
      os TEXT,
      appVersion TEXT,
      entryScreen TEXT,
      exitScreen TEXT,
      featuresVisited TEXT NOT NULL DEFAULT '[]',
      actionsCompleted TEXT NOT NULL DEFAULT '[]',
      errorCount INTEGER NOT NULL DEFAULT 0,
      lastEventAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_userId ON user_sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_startedAt ON user_sessions(startedAt);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_lastEventAt ON user_sessions(lastEventAt);
  `);
}

export function dbFileSizeBytes(): number {
  try {
    return fs.statSync(DB_PATH).size;
  } catch {
    return 0;
  }
}

// Run migrations as soon as this module is first imported, rather than
// relying on store.ts to trigger them - memoryService.ts and any future
// module that talks to `db` directly must not have to remember to import
// store.ts first just to get its tables created.
runMigrations();

export { DB_PATH };
