import { Router } from 'express';
import {
  readingsById,
  conversationsById,
  tarotReadingsById,
  gemstoneReportsById,
  vastuReportsById,
  dailyHoroscopesByKey,
  userPlans,
  getUserTier,
  transactions,
  Transaction,
  adminAuditLog,
  moodEntriesByUserDate, journalEntriesById, breathingSessionsById, habitsById,
  challengeProgressByKey, meditationSessionsById, wellnessGoalsById, wellnessAnalyticsEvents,
} from '../data/store';
import { PRICING_TABLE_VERSION } from '../data/pricing';
import { AiProvider } from '../ai/types';
import { assistantConversationsById, assistantUsageLog } from '../data/store';
import { assistantConfig, setAssistantConfig, AssistantConfig } from '../data/assistantConfig';
import { DB_PATH, dbFileSizeBytes } from '../data/db';
import { memoryAdminStats } from '../memory/memoryService';

/**
 * PROTOTYPE-GRADE ADMIN AUTH, NOT REAL AUTH.
 *
 * There is no admin login/session system anywhere in this app (there is no
 * real user auth at all - see currentUserId() in every other route file).
 * This middleware is a stand-in that reads a plain `x-admin-role` header and
 * checks it against a hardcoded allowlist. It has no password, no token, no
 * expiry, and anyone who knows the header value can call every /admin route.
 * This MUST be replaced with real authenticated admin sessions (e.g. signed
 * tokens tied to a real admin-user table) before this is ever exposed outside
 * a trusted local/dev environment.
 */
const ADMIN_ROLES = ['super_admin', 'analyst', 'viewer'] as const;
type AdminRole = typeof ADMIN_ROLES[number];

/**
 * Password-login session store for the browser admin panel (/admin-panel).
 * This is still a prototype-grade stand-in, not real auth: one shared
 * password for every admin, tokens live only in memory (lost on restart),
 * and there is no rate limiting on login attempts. Do not expose this
 * server outside a trusted network with this mechanism in place.
 */
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || '12345';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const adminSessions = new Map<string, { role: AdminRole; expiresAt: number }>();

function createAdminSession(role: AdminRole): string {
  const token = [...Array(32)].map(() => Math.floor(Math.random() * 36).toString(36)).join('');
  adminSessions.set(token, { role, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

/**
 * Login rate limiting, in-memory and per-process only (same caveat as the
 * session store above: it resets on restart and is not shared across
 * instances/workers). Tracks consecutive failed attempts per IP and locks
 * that IP out for LOCKOUT_MS after MAX_FAILED_ATTEMPTS, then resets the
 * counter on a successful login.
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;
const loginAttemptsByIp = new Map<string, { failures: number; lockedUntil: number | null }>();

function clientIp(req: any): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
}

export function handleAdminLogin(req: any, res: any) {
  const ip = clientIp(req);
  const state = loginAttemptsByIp.get(ip) ?? { failures: 0, lockedUntil: null };

  if (state.lockedUntil && state.lockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: `Too many failed login attempts. Try again in ${retryAfterSeconds}s.`, retryAfterSeconds });
  }

  const { password } = req.body ?? {};
  if (password !== ADMIN_PANEL_PASSWORD) {
    state.failures += 1;
    if (state.failures >= MAX_FAILED_ATTEMPTS) {
      state.lockedUntil = Date.now() + LOCKOUT_MS;
      state.failures = 0;
    }
    loginAttemptsByIp.set(ip, state);
    return res.status(401).json({ error: 'Incorrect password' });
  }

  loginAttemptsByIp.delete(ip);
  const token = createAdminSession('super_admin');
  res.json({ token, role: 'super_admin', expiresAt: adminSessions.get(token)!.expiresAt });
}

/**
 * Query-param token acceptance, deliberately narrow: ONLY the CSV export
 * route accepts `?token=` as a stand-in for the Authorization header. This
 * is needed because a plain browser navigation/download link cannot set
 * custom request headers, so the only way to pass the session token to a
 * GET-by-URL download is via the query string. The panel UI itself uses the
 * blob-fetch approach instead (fetch with the Authorization header, then
 * save the blob) for every other case, which avoids a token ever appearing
 * in a URL, browser history, or server access logs. We keep this fallback
 * only for the one row-count edge case the task calls out: narrowly scoping
 * it to a single documented route keeps the tradeoff contained.
 */
const QUERY_TOKEN_ROUTES = new Set(['/users/export']);

function requireAdminRole(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'] as string | undefined;
  let bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!bearer && QUERY_TOKEN_ROUTES.has(req.path) && typeof req.query.token === 'string') {
    bearer = req.query.token;
  }
  if (bearer) {
    const session = adminSessions.get(bearer);
    if (session && session.expiresAt > Date.now()) {
      req.adminRole = session.role;
      logAdminAction(req);
      return next();
    }
    if (session) adminSessions.delete(bearer); // expired
    return res.status(403).json({ error: 'Forbidden: session missing or expired, please log in again' });
  }

  const role = req.headers['x-admin-role'] as string | undefined;
  if (!role || !ADMIN_ROLES.includes(role as AdminRole)) {
    return res.status(403).json({ error: 'Forbidden: missing or invalid x-admin-role header, or Authorization: Bearer <token>' });
  }
  req.adminRole = role;
  logAdminAction(req);
  next();
}

/** Appends one audit-log entry per authenticated /admin/* request. In-memory
 * only, same caveat as every other store in this app - lost on restart. */
function logAdminAction(req: any) {
  adminAuditLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    role: req.adminRole,
    action: req.method,
    path: req.originalUrl || req.path,
    createdAt: new Date().toISOString(),
  });
}

interface DateRange {
  since?: Date;
  until?: Date;
}

function parseDateRange(req: any): DateRange {
  const since = req.query.since ? new Date(String(req.query.since)) : undefined;
  const until = req.query.until ? new Date(String(req.query.until)) : undefined;
  return {
    since: since && !isNaN(since.getTime()) ? since : undefined,
    until: until && !isNaN(until.getTime()) ? until : undefined,
  };
}

function inRange(createdAt: string | undefined, range: DateRange): boolean {
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  if (isNaN(t)) return true;
  if (range.since && t < range.since.getTime()) return false;
  if (range.until && t > range.until.getTime()) return false;
  return true;
}

/** A per-user activity record built by scanning every in-memory store, since
 * there is no single users table in this app. */
interface UserActivity {
  userId: string;
  tarot: number;
  gemstone: number;
  vastu: number;
  astrology: number;
  palm: number;
  companion: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

function emptyActivity(userId: string): UserActivity {
  return {
    userId,
    tarot: 0,
    gemstone: 0,
    vastu: 0,
    astrology: 0,
    palm: 0,
    companion: 0,
    firstSeen: null,
    lastSeen: null,
  };
}

function touch(activity: UserActivity, createdAt: string | undefined) {
  if (!createdAt) return;
  if (!activity.firstSeen || createdAt < activity.firstSeen) activity.firstSeen = createdAt;
  if (!activity.lastSeen || createdAt > activity.lastSeen) activity.lastSeen = createdAt;
}

/** Scans every known store and builds a userId -> activity map. This is the
 * only way to enumerate "users" in this app since there is no users table. */
function buildUserActivity(range: DateRange): Map<string, UserActivity> {
  const byUser = new Map<string, UserActivity>();
  const get = (userId: string) => {
    let a = byUser.get(userId);
    if (!a) {
      a = emptyActivity(userId);
      byUser.set(userId, a);
    }
    return a;
  };

  for (const r of tarotReadingsById.values()) {
    if (!inRange(r.createdAt, range)) continue;
    const a = get(r.userId);
    a.tarot += 1;
    touch(a, r.createdAt);
  }
  for (const r of gemstoneReportsById.values()) {
    if (!inRange(r.createdAt, range)) continue;
    const a = get(r.userId);
    a.gemstone += 1;
    touch(a, r.createdAt);
  }
  for (const r of vastuReportsById.values()) {
    if (!inRange(r.createdAt, range)) continue;
    const a = get(r.userId);
    a.vastu += 1;
    touch(a, r.createdAt);
  }
  for (const r of dailyHoroscopesByKey.values()) {
    if (!inRange(r.createdAt, range)) continue;
    const a = get(r.userId);
    a.astrology += 1;
    touch(a, r.createdAt);
  }
  for (const r of readingsById.values()) {
    if (!inRange(r.createdAt, range)) continue;
    const a = get(r.userId);
    a.palm += 1;
    touch(a, r.createdAt);
  }
  for (const r of conversationsById.values()) {
    // Conversation has no createdAt field, so date-range filtering can't be
    // applied to it honestly; it is counted unconditionally.
    const a = get(r.userId);
    a.companion += 1;
  }
  // Make sure users who only ever set a tier (via /dev/set-tier) still show up.
  for (const userId of userPlans.keys()) {
    get(userId);
  }
  return byUser;
}

function transactionsInRange(range: DateRange): Transaction[] {
  return transactions.filter((t) => inRange(t.createdAt, range));
}

/** Revenue summary scoped to one feature, for the per-feature admin endpoints. */
function featureRevenue(range: DateRange, feature: string) {
  const rows = transactionsInRange(range).filter((t) => t.feature === feature);
  const totalCents = rows.reduce((sum, t) => sum + t.amountCents, 0);
  return { feature, count: rows.length, totalCents, currency: 'INR', pricingTableVersion: PRICING_TABLE_VERSION };
}

/** Aggregates a set of transactions into totals + per-feature breakdown +
 * a daily time series, for /admin/revenue and the overview/per-feature
 * revenue fields. */
function summarizeRevenue(rows: Transaction[]) {
  const byFeature: Record<string, { count: number; totalCents: number }> = {};
  const byDay: Record<string, number> = {};
  let totalCents = 0;
  for (const t of rows) {
    byFeature[t.feature] = byFeature[t.feature] ?? { count: 0, totalCents: 0 };
    byFeature[t.feature].count += 1;
    byFeature[t.feature].totalCents += t.amountCents;
    totalCents += t.amountCents;
    const day = t.createdAt.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + t.amountCents;
  }
  const dailySeries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalCentsForDay]) => ({ date, totalCents: totalCentsForDay }));
  return {
    totalCents,
    count: rows.length,
    currency: 'INR',
    byFeature,
    dailySeries,
    pricingTableVersion: PRICING_TABLE_VERSION,
    note: 'Amounts are based on the assumed/test pricing table in server/src/data/pricing.ts, not a real payment gateway - there is no Stripe or App/Play Billing integration in this app, so no real money has moved. Every row here is grounded in a real premium unlock event that actually happened.',
  };
}

export function buildAdminRouter(aiProvider: AiProvider) {
  const router = Router();

  router.use(requireAdminRole);

  // --- Overview --------------------------------------------------------
  router.get('/overview', (req, res) => {
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);

    let premium = 0;
    let free = 0;
    for (const userId of activity.keys()) {
      if (getUserTier(userId) === 'premium') premium += 1;
      else free += 1;
    }

    const countInRange = (map: Map<string, { createdAt: string }>) =>
      [...map.values()].filter((r) => inRange(r.createdAt, range)).length;

    res.json({
      range: { since: range.since?.toISOString() ?? null, until: range.until?.toISOString() ?? null },
      totalUsers: activity.size,
      usersByTier: { premium, free },
      readingsByFeature: {
        tarot: countInRange(tarotReadingsById as any),
        gemstone: countInRange(gemstoneReportsById as any),
        vastu: countInRange(vastuReportsById as any),
        astrology: countInRange(dailyHoroscopesByKey as any),
        palm: countInRange(readingsById as any),
        companion: conversationsById.size, // no createdAt on Conversation - not date-filterable
      },
      revenue: summarizeRevenue(transactionsInRange(range)),
      aiCost: { available: false, reason: 'AiProvider calls are not instrumented for token usage, latency, or cost anywhere in the codebase.' },
    });
  });

  // --- Users list --------------------------------------------------------
  router.get('/users', (req, res) => {
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);
    const search = (req.query.search as string | undefined)?.toLowerCase();
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    let rows = [...activity.values()].map((a) => ({
      userId: a.userId,
      tier: getUserTier(a.userId),
      readingCounts: {
        tarot: a.tarot,
        gemstone: a.gemstone,
        vastu: a.vastu,
        astrology: a.astrology,
        palm: a.palm,
        companion: a.companion,
      },
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    }));

    if (search) {
      rows = rows.filter((r) => r.userId.toLowerCase().includes(search));
    }
    rows.sort((a, b) => a.userId.localeCompare(b.userId));

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    res.json({ total, page, pageSize, users: pageRows });
  });

  // --- Users CSV export ----------------------------------------------------
  // Same role-check as every other /admin route, plus (only for this route)
  // the narrow query-param token fallback documented above requireAdminRole.
  // Streams the full, unpaginated list respecting the same search/date-range
  // filters as GET /users.
  router.get('/users/export', (req, res) => {
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);
    const search = (req.query.search as string | undefined)?.toLowerCase();

    let rows = [...activity.values()].map((a) => ({
      userId: a.userId,
      tier: getUserTier(a.userId),
      tarot: a.tarot,
      gemstone: a.gemstone,
      vastu: a.vastu,
      astrology: a.astrology,
      palm: a.palm,
      companion: a.companion,
      firstSeen: a.firstSeen ?? '',
      lastSeen: a.lastSeen ?? '',
    }));
    if (search) rows = rows.filter((r) => r.userId.toLowerCase().includes(search));
    rows.sort((a, b) => a.userId.localeCompare(b.userId));

    const header = 'userId,tier,tarot,gemstone,vastu,astrology,palm,companion,firstSeen,lastSeen';
    const csvEscape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = rows.map((r) =>
      [r.userId, r.tier, r.tarot, r.gemstone, r.vastu, r.astrology, r.palm, r.companion, r.firstSeen, r.lastSeen]
        .map((v) => csvEscape(String(v)))
        .join(',')
    );
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="solune-users.csv"');
    res.send(csv);
  });

  // --- Revenue ---------------------------------------------------------------
  router.get('/revenue', (req, res) => {
    const range = parseDateRange(req);
    res.json(summarizeRevenue(transactionsInRange(range)));
  });

  // --- Admin audit log ---------------------------------------------------------
  // In-memory only (see adminAuditLog in data/store.ts): one entry per
  // authenticated /admin/* request, recorded by requireAdminRole above.
  router.get('/audit-log', (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
    const sorted = [...adminAuditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    res.json({ total, page, pageSize, entries: sorted.slice(start, start + pageSize) });
  });

  // --- User detail ---------------------------------------------------------
  router.get('/users/:userId', (req, res) => {
    const { userId } = req.params;
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);
    const a = activity.get(userId);
    if (!a) {
      return res.status(404).json({ error: 'No activity found for this userId' });
    }
    // Deliberately only counts/timestamps - never reading content, questions,
    // birth details, or AI interpretations, per the admin-table privacy rule.
    res.json({
      userId: a.userId,
      tier: getUserTier(a.userId),
      readingCounts: {
        tarot: a.tarot,
        gemstone: a.gemstone,
        vastu: a.vastu,
        astrology: a.astrology,
        palm: a.palm,
        companion: a.companion,
      },
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    });
  });

  // --- Per-feature breakdowns ----------------------------------------------
  router.get('/tarot', (req, res) => {
    const range = parseDateRange(req);
    const rows = [...tarotReadingsById.values()].filter((r) => inRange(r.createdAt, range));
    const byStatus: Record<string, number> = {};
    const byDetailedReportStatus: Record<string, number> = {};
    let premium = 0, free = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byDetailedReportStatus[r.detailedReportStatus] = (byDetailedReportStatus[r.detailedReportStatus] ?? 0) + 1;
      if (getUserTier(r.userId) === 'premium') premium += 1; else free += 1;
    }
    res.json({ total: rows.length, byStatus, byDetailedReportStatus, byTier: { premium, free }, revenue: featureRevenue(range, 'tarot_detailed_report') });
  });

  router.get('/gemstone', (req, res) => {
    const range = parseDateRange(req);
    const rows = [...gemstoneReportsById.values()].filter((r) => inRange(r.createdAt, range));
    const byDataCompleteness: Record<string, number> = {};
    const byExplanationSource: Record<string, number> = {};
    let premium = 0, free = 0;
    for (const r of rows) {
      byDataCompleteness[r.dataCompleteness] = (byDataCompleteness[r.dataCompleteness] ?? 0) + 1;
      byExplanationSource[r.explanationSource] = (byExplanationSource[r.explanationSource] ?? 0) + 1;
      if (getUserTier(r.userId) === 'premium') premium += 1; else free += 1;
    }
    res.json({ total: rows.length, byDataCompleteness, byExplanationSource, byTier: { premium, free }, revenue: featureRevenue(range, 'gemstone_premium_report') });
  });

  router.get('/vastu', (req, res) => {
    const range = parseDateRange(req);
    const rows = [...vastuReportsById.values()].filter((r) => inRange(r.createdAt, range));
    const byGenerationStatus: Record<string, number> = {};
    const byCompleteness: Record<string, number> = {};
    let premium = 0, free = 0;
    for (const r of rows) {
      byGenerationStatus[r.generationStatus] = (byGenerationStatus[r.generationStatus] ?? 0) + 1;
      byCompleteness[r.completeness] = (byCompleteness[r.completeness] ?? 0) + 1;
      if (getUserTier(r.userId) === 'premium') premium += 1; else free += 1;
    }
    res.json({ total: rows.length, byGenerationStatus, byCompleteness, byTier: { premium, free }, revenue: featureRevenue(range, 'vastu_premium_report') });
  });

  router.get('/astrology', (req, res) => {
    const range = parseDateRange(req);
    const rows = [...dailyHoroscopesByKey.values()].filter((r) => inRange(r.createdAt, range));
    const byGenerationStatus: Record<string, number> = {};
    const bySystem: Record<string, number> = {};
    let premium = 0, free = 0;
    for (const r of rows) {
      byGenerationStatus[r.generationStatus] = (byGenerationStatus[r.generationStatus] ?? 0) + 1;
      bySystem[r.astrologySystem] = (bySystem[r.astrologySystem] ?? 0) + 1;
      if (getUserTier(r.userId) === 'premium') premium += 1; else free += 1;
    }
    res.json({ total: rows.length, byGenerationStatus, bySystem, byTier: { premium, free }, revenue: featureRevenue(range, 'astrology_premium_report') });
  });

  router.get('/palm', (req, res) => {
    const range = parseDateRange(req);
    const rows = [...readingsById.values()].filter((r) => inRange(r.createdAt, range));
    let premium = 0, free = 0;
    let qualityOk = 0, qualityIssue = 0;
    for (const r of rows) {
      if (getUserTier(r.userId) === 'premium') premium += 1; else free += 1;
      if (r.analysis?.imageQuality?.ok) qualityOk += 1; else qualityIssue += 1;
    }
    res.json({ total: rows.length, byImageQuality: { ok: qualityOk, issue: qualityIssue }, byTier: { premium, free }, revenue: featureRevenue(range, 'palm_premium_report') });
  });

  router.get('/wellness', (req, res) => {
    const range = parseDateRange(req);
    const moodEntries = [...moodEntriesByUserDate.values()].filter((e) => inRange(e.createdAt, range));
    const journalEntries = [...journalEntriesById.values()].filter((e) => !e.deletedAt && !e.isDraft && inRange(e.createdAt, range));
    const breathingSessions = [...breathingSessionsById.values()].filter((s) => inRange(s.createdAt, range));
    const habits = [...habitsById.values()].filter((h) => inRange(h.createdAt, range));
    const challengeProgress = [...challengeProgressByKey.values()];
    const meditationSessions = [...meditationSessionsById.values()].filter((s) => inRange(s.startedAt, range));
    const goals = [...wellnessGoalsById.values()].filter((g) => inRange(g.createdAt, range));
    const events = wellnessAnalyticsEvents.filter((e) => inRange(e.createdAt, range));

    const eventsByType: Record<string, number> = {};
    for (const e of events) eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;

    res.json({
      moodEntries: { total: moodEntries.length },
      journalEntries: { total: journalEntries.length, byType: journalEntries.reduce((acc: Record<string, number>, e) => { acc[e.type] = (acc[e.type] ?? 0) + 1; return acc; }, {}) },
      breathingSessions: { total: breathingSessions.length, completed: breathingSessions.filter((s) => s.completed).length },
      habits: { totalActive: habits.filter((h) => h.active).length },
      challenges: { activeParticipants: challengeProgress.filter((c) => c.status === 'active').length, completed: challengeProgress.filter((c) => c.status === 'completed').length },
      meditationSessions: { total: meditationSessions.length, completed: meditationSessions.filter((s) => s.completed).length },
      goals: { total: goals.length, completed: goals.filter((g) => g.status === 'completed').length },
      analyticsEventsByType: eventsByType,
    });
  });

  // --- AI Chat (centralized assistant) analytics ----------------------------
  // Counts/aggregates only - never full private conversation text, per the
  // same privacy rule already applied to GET /users/:userId above.
  router.get('/assistant', (req, res) => {
    const range = parseDateRange(req);
    const conversations = [...assistantConversationsById.values()].filter((c) => inRange(c.createdAt, range));
    const usageRows = assistantUsageLog.filter((u) => inRange(u.createdAt, range));

    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const avgMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0;

    // DAU/MAU for chat, defined here as: distinct userIds with at least one
    // assistant message in the last 1 / 30 days from now (not from `range`,
    // since DAU/MAU are inherently "as of now" rolling metrics).
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const activeUsersWithin = (ms: number) => {
      const ids = new Set<string>();
      for (const c of assistantConversationsById.values()) {
        if (now - new Date(c.updatedAt).getTime() <= ms) ids.add(c.userId);
      }
      return ids.size;
    };

    const byFeature: Record<string, number> = {};
    let premiumCardShown = 0;
    let premiumCardNotShown = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostCents = 0;
    let totalLatencyMs = 0;
    let successCount = 0;

    // Real pipeline timing breakdown, from responseBuilder's instrumentation
    // (added for the speed-optimization pass). Only rows that actually
    // recorded a given stage contribute to that stage's average, since
    // intentDetectionMs/dataRetrievalMs/etc are optional fields that may be
    // absent on older log entries or on paths that skip a stage entirely.
    const stageSums = { intentDetectionMs: 0, dataRetrievalMs: 0, timeToFirstTokenMs: 0, generationMs: 0 };
    const stageCounts = { intentDetectionMs: 0, dataRetrievalMs: 0, timeToFirstTokenMs: 0, generationMs: 0 };

    // Per-mode breakdown (FAST / DEEP_ANALYSIS / PREMIUM_REPORT, see
    // server/src/assistant/modeClassifier.ts). 'no_generation' buckets rows
    // where no AI call happened at all (crisis response, no data on file,
    // etc) - their near-zero latency would otherwise silently drag down the
    // other buckets' averages if merged in.
    type ModeKey = 'fast' | 'deep_analysis' | 'premium_report' | 'no_generation';
    const modeSums: Record<ModeKey, { count: number; latencyMs: number; costCents: number }> = {
      fast: { count: 0, latencyMs: 0, costCents: 0 },
      deep_analysis: { count: 0, latencyMs: 0, costCents: 0 },
      premium_report: { count: 0, latencyMs: 0, costCents: 0 },
      no_generation: { count: 0, latencyMs: 0, costCents: 0 },
    };

    for (const u of usageRows) {
      const modeKey: ModeKey = u.mode ?? 'no_generation';
      modeSums[modeKey].count += 1;
      modeSums[modeKey].latencyMs += u.latencyMs;
      modeSums[modeKey].costCents += u.estimatedCostCents;
      const key = u.detectedFeature ?? 'unknown';
      byFeature[key] = (byFeature[key] ?? 0) + 1;
      if (u.premiumCardShown) premiumCardShown += 1; else premiumCardNotShown += 1;
      totalInputTokens += u.estimatedInputTokens;
      totalOutputTokens += u.estimatedOutputTokens;
      totalCostCents += u.estimatedCostCents;
      totalLatencyMs += u.latencyMs;
      if (u.success) successCount += 1;

      for (const stage of Object.keys(stageSums) as (keyof typeof stageSums)[]) {
        const value = u[stage];
        if (typeof value === 'number') {
          stageSums[stage] += value;
          stageCounts[stage] += 1;
        }
      }
    }

    const avgStageMs = Object.fromEntries(
      (Object.keys(stageSums) as (keyof typeof stageSums)[]).map((stage) => [
        stage,
        stageCounts[stage] > 0 ? stageSums[stage] / stageCounts[stage] : null,
      ])
    ) as Record<keyof typeof stageSums, number | null>;

    const slowestStage = (Object.keys(avgStageMs) as (keyof typeof avgStageMs)[])
      .filter((stage) => avgStageMs[stage] !== null)
      .sort((a, b) => (avgStageMs[b] as number) - (avgStageMs[a] as number))[0] ?? null;

    const byMode = Object.fromEntries(
      (Object.keys(modeSums) as ModeKey[]).map((mode) => {
        const s = modeSums[mode];
        return [mode, {
          count: s.count,
          avgLatencyMs: s.count > 0 ? s.latencyMs / s.count : null,
          avgCostCents: s.count > 0 ? s.costCents / s.count : null,
        }];
      })
    );

    res.json({
      range: { since: range.since?.toISOString() ?? null, until: range.until?.toISOString() ?? null },
      totalConversations,
      totalMessages,
      avgMessagesPerConversation,
      dau: activeUsersWithin(dayMs),
      mau: activeUsersWithin(30 * dayMs),
      dauMauDefinition: 'Distinct userIds with an assistant conversation updated within the last 1 (DAU) or 30 (MAU) days from now, independent of the since/until range filter above.',
      byFeature,
      premiumRecommendation: { shown: premiumCardShown, notShown: premiumCardNotShown },
      usage: {
        estimatedInputTokens: totalInputTokens,
        estimatedOutputTokens: totalOutputTokens,
        estimatedCostCents: totalCostCents,
        currency: 'INR',
        note: 'Token counts are a rough ~4-chars-per-token estimate, not real metering - see server/src/assistant/responseBuilder.ts. Cost uses a documented flat assumed per-1k-token rate, not a real AI provider bill.',
      },
      avgLatencyMs: usageRows.length > 0 ? totalLatencyMs / usageRows.length : 0,
      errorRate: usageRows.length > 0 ? (usageRows.length - successCount) / usageRows.length : 0,
      totalRequests: usageRows.length,
      performance: {
        avgStageMs,
        slowestStage,
        byMode,
        note: 'Averages only include log rows that actually recorded a given stage - some paths (e.g. the AI-classification fallback, or a request with no detected feature) skip stages that do not apply to them. Values are null when no row recorded that stage in the selected range. byMode breaks the same latency/cost down per FAST/DEEP_ANALYSIS/PREMIUM_REPORT classification; no_generation covers rows where no AI call happened at all (e.g. crisis response, no data on file).',
      },
    });
  });

  router.get('/assistant-config', (_req, res) => {
    res.json(assistantConfig);
  });

  router.put('/assistant-config', (req, res) => {
    // Config mutation, not a read - restrict to super_admin specifically,
    // unlike the read-only /admin/assistant-config and analytics endpoints
    // above which any of the three allowed roles can view.
    if ((req as any).adminRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin may modify assistant configuration.' });
    }
    const body = req.body ?? {};
    const next: Partial<AssistantConfig> = {};
    if (typeof body.name === 'string') next.name = body.name;
    if (typeof body.welcomeMessage === 'string') next.welcomeMessage = body.welcomeMessage;
    if (typeof body.systemInstructions === 'string') next.systemInstructions = body.systemInstructions;
    if (typeof body.premiumRecommendationCopy === 'string') next.premiumRecommendationCopy = body.premiumRecommendationCopy;
    if (body.enabledFeatures && typeof body.enabledFeatures === 'object') next.enabledFeatures = body.enabledFeatures;
    res.json(setAssistantConfig(next));
  });

  // --- System / health -----------------------------------------------------
  router.get('/system', (_req, res) => {
    res.json({
      uptimeSeconds: process.uptime(),
      nodeVersion: process.version,
      aiProvider: (() => {
        const name = (aiProvider as any).innerProviderName ?? aiProvider.constructor.name;
        if (name === 'GeminiProvider') return 'gemini';
        if (name === 'AnthropicProvider') return 'anthropic';
        return 'mock';
      })(),
      recordCountsByStore: {
        palmReadings: readingsById.size,
        conversations: conversationsById.size,
        tarotReadings: tarotReadingsById.size,
        gemstoneReports: gemstoneReportsById.size,
        vastuReports: vastuReportsById.size,
        dailyHoroscopes: dailyHoroscopesByKey.size,
        userPlans: userPlans.size,
      },
      persistence: {
        backend: 'sqlite',
        dbFilePath: DB_PATH,
        dbFileSizeBytes: dbFileSizeBytes(),
        note: 'All stores above are now backed by a real SQLite file (server/data/solune.db) and genuinely survive a server restart - see memory-system section below for the newer structured memory tables specifically.',
      },
      errorMonitoring: { available: false, reason: 'No Sentry or other APM/error-monitoring integration exists in this codebase.' },
    });
  });

  // --- Persistent memory system monitoring (counts/aggregates only - never
  // conversation or report content, same privacy convention as the AI Chat
  // tab above). ---------------------------------------------------------------
  router.get('/memory', (_req, res) => {
    const stats = memoryAdminStats();
    res.json({
      totalSavedReadings: stats.totalSavedReadings,
      savedReadingsByFeature: stats.savedReadingsByFeature,
      conversationMemoryFactCount: stats.conversationMemoryFactCount,
      memoryRetrievalRequests: stats.memoryRetrievalRequests,
      memoryRetrievalSuccesses: stats.memoryRetrievalSuccesses,
      memoryRetrievalSuccessRate: stats.memoryRetrievalRequests
        ? stats.memoryRetrievalSuccesses / stats.memoryRetrievalRequests
        : null,
      deletionRequests: stats.deletionRequests,
      dbFileSizeBytes: dbFileSizeBytes(),
      note: 'Counts/aggregates only - no conversation or report content is ever exposed through this endpoint.',
    });
  });

  return router;
}
