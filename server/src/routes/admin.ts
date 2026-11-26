import { listBackups, runBackup } from '../ops/backup';
import { lastGuestCleanup, cleanupExpiredGuests } from '../ops/guestCleanup';
import { errorsLastHour, readRecentErrors } from '../ops/alerts';
import { estimateCostInr, providerKeyFromName, getSpendRecord, getBudgetStatus } from '../ai/budget';
import { Router, Request, Response, NextFunction } from 'express';
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
  moodEntriesByUserDate, journalEntriesById, breathingSessionsById, habitsById,
  challengeProgressByKey, meditationSessionsById, wellnessGoalsById, wellnessAnalyticsEvents,
  soulmateSketchesById, soulmateAnalyticsEvents,
  accountsById, userIdentities, birthProfiles, guestSessionsById,
} from '../data/store';
import { PRICING_TABLE_VERSION, getPricingCents, setPricingCents, defaultPricingCents, PricedFeature } from '../data/pricing';
import { getSubscriptionBasePrices, setSubscriptionBasePrices, defaultSubscriptionBasePrices, getSubscriptionPlans } from '../data/subscriptionPlans';
import { getAiBudgetCaps, setAiBudgetCaps, defaultAiBudgetCaps } from '../ai/budget';
import { getFeatureFlags, setFeatureFlag } from '../data/featureFlags';
import { listTopAiSpenders } from '../ai/budget';
import { getApiMonitoringOverview } from '../ops/apiMonitoring';
import { evaluateAlerts, getAlertThresholds, setAlertThresholds, listIncidents, openIncident, resolveIncident } from '../ops/alertsEngine';
import { getAcquisitionOverTime, getFunnel, FUNNEL_DEFINITIONS, getRetentionCohorts } from '../analytics/productAnalytics';
import { AiProvider } from '../ai/types';
import { assistantConversationsById, assistantUsageLog, aiUsageEvents } from '../data/store';
import { assistantConfig, setAssistantConfig, AssistantConfig } from '../data/assistantConfig';
import { DB_PATH, dbFileSizeBytes } from '../data/db';
import { memoryAdminStats } from '../memory/memoryService';
import { getPsuIdForUuid, getUuidForPsuId } from '../auth/psuId';
import { listEvents, listEventsSince } from '../events/eventTracker';
import { listSessionsForUser, getUserEngagementStats, getLatestDeviceInfo, getSessionsOverview } from '../events/sessionTracker';
import {
  AdminRole, performAdminLogin, resolveAdminSession,
  listSessionsForAdmin, revokeSession, revokeAllSessionsForAdmin, listLoginHistory,
  logAdminAudit, listAdminAudit, findAdminById, generateTotpSecret, totpOtpauthUrl,
  verifyTotpCode, setAdminMfa,
  listAdminUsers, createAdminUser, setAdminRole, setAdminStatus, findAdminByEmail,
} from '../auth/adminAuth';

/**
 * Real admin authentication, backed by admin_users/admin_sessions in
 * SQLite (see auth/adminAuth.ts). Replaces the old single-shared-password
 * + in-memory-session + "or just send any x-admin-role header" mechanism
 * that used to live here - that bypass let anyone in with no secret at
 * all and has been removed entirely, not just deprecated.
 */

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
}

export async function handleAdminLogin(req: Request, res: Response) {
  const ip = clientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  const { email, password, totpCode } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const result = await performAdminLogin({ email: String(email), password: String(password), totpCode, ip, userAgent });
  if (!result.ok) {
    if (result.retryAfterSeconds) res.setHeader('Retry-After', String(result.retryAfterSeconds));
    return res.status(result.status).json({ error: result.error });
  }
  res.json({ token: result.token, role: result.role, expiresAt: result.expiresAt, email: result.email });
}

export function handleAdminLogout(req: Request, res: Response) {
  const admin = req.admin as { adminId: string; sessionId: string } | undefined;
  if (!admin) return res.status(401).json({ error: 'Not logged in.' });
  revokeSession(admin.adminId, admin.sessionId);
  logAdminAudit({ adminId: admin.adminId, action: 'LOGOUT', path: req.originalUrl });
  res.json({ ok: true });
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
const QUERY_TOKEN_ROUTES = new Set(['/users/export', '/transactions/export', '/events/export']);

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = rows.map((r) => r.map((v) => csvEscape(String(v))).join(','));
  return [header.join(','), ...lines].join('\n');
}

function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'] as string | undefined;
  let bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!bearer && QUERY_TOKEN_ROUTES.has(req.path) && typeof req.query.token === 'string') {
    bearer = req.query.token;
  }

  if (!bearer) {
    return res.status(401).json({ error: 'Unauthorized: missing Authorization: Bearer <token>. Log in via POST /admin/login first.' });
  }

  const session = resolveAdminSession(bearer);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: session missing, expired, or revoked. Please log in again.' });
  }

  req.adminRole = session.role;
  req.admin = session;
  logAdminAudit({ adminId: session.adminId, action: req.method, path: req.originalUrl || req.path });
  next();
}

/** Restricts a route to one or more roles, beyond the baseline requireAdminRole check. */
function requireRole(...roles: AdminRole[]) {
  return (req: any, res: any, next: NextFunction) => {
    if (!roles.includes(req.adminRole)) {
      logAdminAudit({ adminId: req.admin!.adminId, action: req.method, path: req.originalUrl || req.path, outcome: 'denied' });
      return res.status(403).json({ error: `Forbidden: requires role ${roles.join(' or ')}, you have ${req.adminRole}.` });
    }
    next();
  };
}

interface DateRange {
  since?: Date;
  until?: Date;
}

function parseDateRange(req: Request): DateRange {
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

/** Real, instrumented AI usage - every entry comes from ai/usageTracking.ts's
 * UsageTrackingProvider, which wraps the single app-wide aiProvider instance,
 * so this covers every feature that calls it (currently Tarot; Palm,
 * Astrology, and the Assistant will appear here automatically once they're
 * updated to pass a `feature` tag, with zero changes needed to this
 * endpoint). Token counts are estimates (~4 chars/token), never a real
 * provider-reported bill - labeled as such rather than presented as exact. */
function summarizeAiUsage(range: DateRange) {
  const rows = aiUsageEvents.filter((e) => inRange(e.createdAt, range));
  const byFeature: Record<string, { calls: number; successes: number; estimatedInputTokens: number; estimatedOutputTokens: number; avgLatencyMs: number; estimatedCostInr: number; actualTokenCalls: number }> = {};
  for (const e of rows) {
    const bucket = byFeature[e.feature] ?? { calls: 0, successes: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, avgLatencyMs: 0, estimatedCostInr: 0, actualTokenCalls: 0 };
    bucket.calls += 1;
    if (e.tokenSource === 'actual') bucket.actualTokenCalls += 1;
    bucket.estimatedCostInr += e.success ? estimateCostInr(e.estimatedInputTokens, e.estimatedOutputTokens, e.tokenSource === 'actual', providerKeyFromName(e.model)) : 0;
    if (e.success) bucket.successes += 1;
    bucket.estimatedInputTokens += e.estimatedInputTokens;
    bucket.estimatedOutputTokens += e.estimatedOutputTokens;
    bucket.avgLatencyMs += e.latencyMs;
    byFeature[e.feature] = bucket;
  }
  for (const key of Object.keys(byFeature)) {
    byFeature[key].avgLatencyMs = Math.round(byFeature[key].avgLatencyMs / byFeature[key].calls);
  }
  return {
    available: true,
    totalCalls: rows.length,
    byFeature,
    totalEstimatedCostInr: Math.round(Object.values(byFeature).reduce((a, b) => a + b.estimatedCostInr, 0) * 100) / 100,
    note: 'Gemini calls report real token counts (actualTokenCalls); anything else is a ~4 chars/token guess. Cost uses the AI_*_USD_PER_MTOK / AI_USD_INR settings, so compare totals with the Google AI Studio / Cloud billing usage page.',
  };
}

export function buildAdminRouter(aiProvider: AiProvider) {
  const router = Router();

  // A date filter the server can't read must be an error, not silently ignored (the admin would think a range was applied).
  router.use((req, res, next) => {
    for (const key of ['since', 'until'] as const) {
      const v = req.query[key];
      if (v !== undefined && v !== '' && isNaN(new Date(String(v)).getTime())) {
        return res.status(400).json({ error: `Invalid '${key}' date. Use YYYY-MM-DD or an ISO timestamp.` });
      }
    }
    next();
  });

  router.use(requireAdminRole);

  // Ops status: backups on disk, recent server errors. POST /ops/backup triggers a snapshot now.
  router.get('/ops/status', (_req, res) => {
    const backups = listBackups();
    res.json({
      backups: backups.slice(0, 10),
      newestBackupAgeHours: backups[0] ? Math.round(((Date.now() - new Date(backups[0].createdAt).getTime()) / 3_600_000) * 10) / 10 : null,
      errorsLastHour: errorsLastHour(),
      recentErrors: readRecentErrors(10),
      alertWebhookConfigured: !!process.env.ALERT_WEBHOOK_URL,
      guestCleanup: lastGuestCleanup(),
    });
  });
  router.get('/sessions-overview', (req, res) => {
    const range = parseDateRange(req);
    res.json(getSessionsOverview(range.since, range.until));
  });

  router.get('/errors', (req, res) => {
    const lines = Math.min(500, Math.max(1, Number(req.query.lines) || 100));
    res.json({
      errorsLastHour: errorsLastHour(),
      alertWebhookConfigured: !!process.env.ALERT_WEBHOOK_URL,
      recentErrors: readRecentErrors(lines),
      note: 'Every reportError() call (see ops/alerts.ts) is logged here - server/data/logs/errors.log, size-capped at 5MB. There is no mobile crash reporter wired in, so this covers backend errors only.',
    });
  });
  router.post('/ops/guest-cleanup', (_req, res) => res.json(cleanupExpiredGuests()));
  router.post('/ops/backup', async (_req, res) => {
    try { res.json(await runBackup()); } catch (err: any) { res.status(500).json({ error: err?.message ?? 'Backup failed' }); }
  });

  // --- Admin session/account self-service -------------------------------
  router.post('/logout', handleAdminLogout);

  router.get('/sessions', (req, res) => {
    res.json({ sessions: listSessionsForAdmin(req.admin!.adminId) });
  });

  router.post('/sessions/:sessionId/revoke', (req, res) => {
    const revoked = revokeSession(req.admin!.adminId, req.params.sessionId);
    logAdminAudit({ adminId: req.admin!.adminId, action: 'SESSION_REVOKE', path: req.originalUrl, targetType: 'admin_session', targetId: req.params.sessionId, outcome: revoked ? 'success' : 'error' });
    res.json({ ok: revoked });
  });

  router.post('/sessions/revoke-all', (req, res) => {
    revokeAllSessionsForAdmin(req.admin!.adminId);
    logAdminAudit({ adminId: req.admin!.adminId, action: 'SESSION_REVOKE_ALL', path: req.originalUrl });
    res.json({ ok: true });
  });

  router.get('/login-history', requireRole('super_admin'), (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
    res.json(listLoginHistory(page, pageSize));
  });

  // --- MFA (TOTP) setup, per logged-in admin ----------------------------
  router.post('/mfa/setup', (req, res) => {
    const admin = findAdminById(req.admin!.adminId);
    if (!admin) return res.status(404).json({ error: 'Admin not found.' });
    const secret = generateTotpSecret();
    setAdminMfa(admin.id, secret, false); // not enabled until verified below
    res.json({ secret, otpauthUrl: totpOtpauthUrl(admin.email, secret) });
  });

  router.post('/mfa/verify', (req, res) => {
    const admin = findAdminById(req.admin!.adminId);
    if (!admin?.mfaSecret) return res.status(400).json({ error: 'Call /mfa/setup first.' });
    const { code } = req.body ?? {};
    if (!code || !verifyTotpCode(admin.mfaSecret, String(code))) {
      return res.status(400).json({ error: 'Incorrect code.' });
    }
    setAdminMfa(admin.id, admin.mfaSecret, true);
    logAdminAudit({ adminId: admin.id, action: 'MFA_ENABLED', path: req.originalUrl });
    res.json({ ok: true });
  });

  router.post('/mfa/disable', (req, res) => {
    setAdminMfa(req.admin!.adminId, null, false);
    logAdminAudit({ adminId: req.admin!.adminId, action: 'MFA_DISABLED', path: req.originalUrl });
    res.json({ ok: true });
  });

  // --- Overview --------------------------------------------------------
  // --- Central event log / Live Activity (see events/eventTracker.ts) ----
  router.get('/events', (req, res) => {
    const range = parseDateRange(req);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
    const { total, entries } = listEvents(
      {
        userId: req.query.userId as string | undefined,
        eventType: req.query.eventType as string | undefined,
        feature: req.query.feature as string | undefined,
        status: req.query.status as any,
        since: range.since,
        until: range.until,
      },
      page,
      pageSize,
    );
    res.json({ total, page, pageSize, entries });
  });

  // Polling-based live feed (no WebSocket/SSE infra exists in this app yet):
  // the panel calls this every few seconds with the createdAt of the last
  // event it already has, and gets back only what's new. Returning at most
  // 100 keeps a single poll bounded even after a burst of activity.
  router.get('/events/live', (req, res) => {
    const after = typeof req.query.after === 'string' ? req.query.after : null;
    res.json({ entries: listEventsSince(after, 100) });
  });

  router.get('/overview', (req, res) => {
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);

    // Same population as the Users list: every registered account plus every user with activity, so a brand-new
    // account with no usage yet is counted here too (the two screens must agree).
    const everyone = new Set<string>([
      ...[...accountsById.values()].filter((a) => inRange(a.createdAt, range)).map((a) => a.id),
      ...activity.keys(),
    ]);
    let premium = 0;
    let free = 0;
    for (const userId of everyone) {
      if (getUserTier(userId) === 'premium') premium += 1;
      else free += 1;
    }

    const countInRange = (map: Map<string, { createdAt: string }>) =>
      [...map.values()].filter((r) => inRange(r.createdAt, range)).length;

    res.json({
      range: { since: range.since?.toISOString() ?? null, until: range.until?.toISOString() ?? null },
      totalUsers: everyone.size,
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
      aiUsage: summarizeAiUsage(range),
    });
  });

  // --- Users list --------------------------------------------------------
  router.get('/users', (req, res) => {
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);
    const search = (req.query.search as string | undefined)?.toLowerCase();
    const tierFilter = req.query.tier as string | undefined;
    const accountTypeFilter = req.query.accountType as string | undefined; // 'registered' | 'guest'
    const deviceFilter = (req.query.device as string | undefined)?.toLowerCase();
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    // Union of every registered account and every userId with any activity -
    // a brand-new account with zero feature usage must still be listable
    // and searchable (by email/name), not silently invisible until they
    // use a feature. buildUserActivity alone would miss them entirely.
    const allUserIds = new Set<string>([...accountsById.keys(), ...activity.keys()]);

    let rows = [...allUserIds].map((userId) => {
      const a = activity.get(userId);
      const account = accountsById.get(userId);
      const identity = userIdentities.get(userId);
      const deviceInfo = getLatestDeviceInfo(userId);
      const spend = getSpendRecord(userId);
      return {
        userId,
        psuId: getPsuIdForUuid(userId),
        name: identity?.name ?? null,
        email: account?.email ?? null,
        accountType: account ? 'registered' as const : 'guest' as const,
        tier: getUserTier(userId),
        device: deviceInfo?.device ?? null,
        os: deviceInfo?.os ?? null,
        aiUsage: { costInr: Math.round((spend?.costInr ?? 0) * 100) / 100, calls: spend?.calls ?? 0 },
        readingCounts: {
          tarot: a?.tarot ?? 0,
          gemstone: a?.gemstone ?? 0,
          vastu: a?.vastu ?? 0,
          astrology: a?.astrology ?? 0,
          palm: a?.palm ?? 0,
          companion: a?.companion ?? 0,
        },
        registeredAt: account?.createdAt ?? null,
        firstSeen: a?.firstSeen ?? null,
        lastSeen: a?.lastSeen ?? null,
      };
    });

    if (search) {
      rows = rows.filter((r) =>
        r.userId.toLowerCase().includes(search) ||
        r.psuId?.toLowerCase().includes(search) ||
        r.email?.toLowerCase().includes(search) ||
        r.name?.toLowerCase().includes(search),
      );
    }
    if (tierFilter) rows = rows.filter((r) => r.tier === tierFilter);
    if (accountTypeFilter) rows = rows.filter((r) => r.accountType === accountTypeFilter);
    if (deviceFilter) rows = rows.filter((r) => r.os?.toLowerCase().includes(deviceFilter) || r.device?.toLowerCase().includes(deviceFilter));

    if (req.query.sortBy === 'aiUsage') rows.sort((a, b) => b.aiUsage.costInr - a.aiUsage.costInr);
    else rows.sort((a, b) => a.userId.localeCompare(b.userId));

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
  router.get('/users/export', requireRole('super_admin', 'analyst'), (req, res) => {
    const range = parseDateRange(req);
    const activity = buildUserActivity(range);
    const search = (req.query.search as string | undefined)?.toLowerCase();

    const allUserIds = new Set<string>([...accountsById.keys(), ...activity.keys()]);
    let rows = [...allUserIds].map((userId) => {
      const a = activity.get(userId);
      const account = accountsById.get(userId);
      const identity = userIdentities.get(userId);
      return {
        userId,
        psuId: getPsuIdForUuid(userId) ?? '',
        name: identity?.name ?? '',
        email: account?.email ?? '',
        tier: getUserTier(userId),
        tarot: a?.tarot ?? 0,
        gemstone: a?.gemstone ?? 0,
        vastu: a?.vastu ?? 0,
        astrology: a?.astrology ?? 0,
        palm: a?.palm ?? 0,
        companion: a?.companion ?? 0,
        firstSeen: a?.firstSeen ?? '',
        lastSeen: a?.lastSeen ?? '',
      };
    });
    if (search) rows = rows.filter((r) => r.userId.toLowerCase().includes(search) || r.email.toLowerCase().includes(search) || r.name.toLowerCase().includes(search));
    rows.sort((a, b) => a.userId.localeCompare(b.userId));

    const header = 'userId,psuId,name,email,tier,tarot,gemstone,vastu,astrology,palm,companion,firstSeen,lastSeen';
    const csvEscape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = rows.map((r) =>
      [r.userId, r.psuId, r.name, r.email, r.tier, r.tarot, r.gemstone, r.vastu, r.astrology, r.palm, r.companion, r.firstSeen, r.lastSeen]
        .map((v) => csvEscape(String(v)))
        .join(',')
    );
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="solune-users.csv"');
    res.send(csv);
  });

  router.get('/transactions/export', requireRole('super_admin', 'analyst'), (req, res) => {
    const range = parseDateRange(req);
    const rows = transactions
      .filter((t) => inRange(t.createdAt, range))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((t) => [t.id, getPsuIdForUuid(t.userId) ?? t.userId, t.feature, t.amountCents, t.currency, t.createdAt]);
    const csv = toCsv(['id', 'psuId', 'feature', 'amountCents', 'currency', 'createdAt'], rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="solune-transactions.csv"');
    res.send(csv);
  });

  router.get('/events/export', requireRole('super_admin', 'analyst'), (req, res) => {
    const range = parseDateRange(req);
    const feature = typeof req.query.feature === 'string' ? req.query.feature : undefined;
    const { entries } = listEvents({ feature, since: range.since, until: range.until }, 1, 50_000);
    const rows = entries
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e) => [e.id, e.userId ? (getPsuIdForUuid(e.userId) ?? e.userId) : '', e.eventType, e.feature, e.status, e.createdAt]);
    const csv = toCsv(['id', 'psuId', 'eventType', 'feature', 'status', 'createdAt'], rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="solune-events.csv"');
    res.send(csv);
  });

  // --- Revenue ---------------------------------------------------------------
  router.get('/revenue', (req, res) => {
    const range = parseDateRange(req);
    res.json(summarizeRevenue(transactionsInRange(range)));
  });

  // --- Subscriptions -----------------------------------------------------
  // Real data from userPlans (see data/store.ts's UserPlan + the Premium
  // paywall redesign) - every field here is whatever /dev/set-tier actually
  // wrote, never fabricated. planId/renewsAt etc. are null for any premium
  // user who was set to that tier before this plan metadata existed.
  router.get('/subscriptions', (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const all = [...userPlans.values()].filter((p) => p.tier === 'premium');
    const byPlan: Record<string, number> = {};
    for (const p of all) {
      const key = p.planId ?? 'unknown';
      byPlan[key] = (byPlan[key] ?? 0) + 1;
    }
    const sorted = all.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
    const start = (page - 1) * pageSize;
    const pageRows = sorted.slice(start, start + pageSize).map((p) => ({
      userId: p.userId,
      psuId: getPsuIdForUuid(p.userId),
      planId: p.planId ?? null,
      status: p.status ?? 'active',
      priceCents: p.priceCents ?? null,
      currency: p.currency ?? null,
      startedAt: p.startedAt ?? null,
      renewsAt: p.renewsAt ?? null,
      expiresAt: p.expiresAt ?? null,
    }));
    res.json({ total: all.length, page, pageSize, byPlan, subscriptions: pageRows });
  });

  // --- Admin audit log ---------------------------------------------------------
  // Durable (admin_audit_log table): one entry per authenticated /admin/*
  // request, recorded by requireAdminRole above, surviving restarts.
  router.get('/audit-log', requireRole('super_admin'), (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
    const { total, entries } = listAdminAudit(page, pageSize);
    res.json({ total, page, pageSize, entries });
  });

  /** Resolves a route param that may be either the internal UUID or a
   * PSU-000001 ID to the internal UUID, or null if neither matches anything. */
  function resolveUserParam(raw: string): string | null {
    if (raw.toUpperCase().startsWith('PSU-')) return getUuidForPsuId(raw);
    return raw;
  }

  function revenueForUser(userId: string) {
    const rows = transactions.filter((t) => t.userId === userId);
    const totalCents = rows.reduce((sum, t) => sum + t.amountCents, 0);
    return { totalCents, currency: 'INR', count: rows.length, transactions: rows };
  }

  /** Every soulmate sketch this user has ever created, oldest-first, as the
   * closest thing this app has to a payment-history table (the only real
   * payment gateway integration is Soulmate Sketch's Razorpay flow). */
  function paymentsForUser(userId: string) {
    return soulmateSketchesById.valuesForUser(userId)
      .map((s) => ({
        sketchId: s.id,
        orderId: s.orderId,
        paymentId: s.paymentId,
        amountCents: s.priceCents,
        currency: s.currency,
        status: s.generationStatus,
        isFreeTrial: s.isFreeTrial,
      }))
      .sort((a, b) => (a.sketchId < b.sketchId ? -1 : 1));
  }

  // --- User 360 profile ------------------------------------------------------
  router.get('/users/:userId', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });

    const account = accountsById.get(userId); // undefined for guests/demo ids - real, not every userId is a registered account
    const identity = userIdentities.get(userId);
    const birthProfile = birthProfiles.get(userId);
    const guestSession = !account ? guestSessionsById.get(userId) : undefined;

    const range = parseDateRange(req);
    const activity = buildUserActivity(range).get(userId);

    // A user is "known" if they're a real account, a guest session, or have
    // any activity at all - otherwise the ID genuinely doesn't exist.
    if (!account && !guestSession && !activity) {
      return res.status(404).json({ error: 'No user found for this ID' });
    }

    const revenue = revenueForUser(userId);
    const engagement = getUserEngagementStats(userId);
    const device = getLatestDeviceInfo(userId);
    const aiBudget = getBudgetStatus(userId);
    const aiSpend = getSpendRecord(userId);

    res.json({
      userId,
      psuId: getPsuIdForUuid(userId),
      accountType: account ? 'registered' : guestSession ? 'guest' : 'legacy_demo',
      profile: {
        name: identity?.name ?? null,
        email: account?.email ?? null,
        // Not collected anywhere in this app today - never fabricated.
        phone: null,
        country: null,
        emailVerified: account?.emailVerified ?? null,
      },
      registeredAt: account?.createdAt ?? guestSession?.createdAt ?? null,
      accountStatus: account ? 'active' : guestSession ? 'guest' : 'unknown',
      tier: getUserTier(userId),
      birthProfile: birthProfile
        ? { birthDate: birthProfile.birthDate, birthPlace: birthProfile.birthPlace, preferredSystem: birthProfile.preferredSystem, updatedAt: birthProfile.updatedAt }
        : null,
      readingCounts: activity
        ? { tarot: activity.tarot, gemstone: activity.gemstone, vastu: activity.vastu, astrology: activity.astrology, palm: activity.palm, companion: activity.companion }
        : { tarot: 0, gemstone: 0, vastu: 0, astrology: 0, palm: 0, companion: 0 },
      firstSeen: activity?.firstSeen ?? null,
      lastSeen: activity?.lastSeen ?? engagement.lastActiveAt,
      revenue: { totalCents: revenue.totalCents, currency: revenue.currency, transactionCount: revenue.count },
      engagement,
      device,
      aiUsage: {
        thisMonthCostInr: Math.round((aiSpend?.costInr ?? 0) * 100) / 100,
        thisMonthCalls: aiSpend?.calls ?? 0,
        byProviderInr: aiBudget.byProviderInr,
        capped: aiBudget.capped,
        limitInr: aiBudget.limitInr,
        remainingInr: aiBudget.remainingInr,
        resetsOn: aiBudget.resetsOn,
      },
    });
  });

  // --- User 360: activity timeline (reuses Phase 1's user_events) --------
  router.get('/users/:userId/timeline', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50));
    const range = parseDateRange(req);
    const { total, entries } = listEvents({ userId, since: range.since, until: range.until }, page, pageSize);
    res.json({ total, page, pageSize, entries });
  });

  // --- User 360: sessions --------------------------------------------------
  router.get('/users/:userId/sessions', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    res.json(listSessionsForUser(userId, page, pageSize));
  });

  // --- User 360: payments ---------------------------------------------------
  router.get('/users/:userId/payments', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    res.json({ payments: paymentsForUser(userId), revenue: revenueForUser(userId) });
  });

  // --- User 360: feature-wise history (metadata/status only, never full
  // AI interpretation text or journal content - same privacy rule as the
  // existing per-feature aggregate endpoints below). -----------------------
  router.get('/users/:userId/tarot', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const readings = tarotReadingsById.valuesForUser(userId)
      .map((r) => ({ id: r.id, readingType: r.readingType, spreadType: r.spreadType, status: r.status, saved: r.saved, detailedReportStatus: r.detailedReportStatus, createdAt: r.createdAt, completedAt: r.completedAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ readings });
  });

  router.get('/users/:userId/palm', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const readings = readingsById.valuesForUser(userId)
      .map((r) => ({ id: r.id, premiumReportAvailable: r.premiumReportAvailable, premiumReportGeneratedAt: r.premiumReportGeneratedAt, isPrimary: r.isPrimary ?? false, createdAt: r.createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ readings });
  });

  router.get('/users/:userId/astrology', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const profile = birthProfiles.get(userId);
    const horoscopes = dailyHoroscopesByKey.valuesForUser(userId)
      .map((h) => ({ id: h.id, localDate: h.localDate, astrologySystem: h.astrologySystem, createdAt: h.createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      birthProfile: profile
        ? { birthDate: profile.birthDate, birthPlace: profile.birthPlace, preferredSystem: profile.preferredSystem, timezone: profile.timezone, updatedAt: profile.updatedAt }
        : null,
      horoscopes,
    });
  });

  router.get('/users/:userId/wellness', (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const moodEntries = moodEntriesByUserDate.valuesForUser(userId);
    const journalEntries = journalEntriesById.valuesForUser(userId).filter((e) => !e.deletedAt);
    const habits = habitsById.valuesForUser(userId);
    const goals = wellnessGoalsById.valuesForUser(userId);
    const meditationSessions = meditationSessionsById.valuesForUser(userId);
    const breathingSessions = breathingSessionsById.valuesForUser(userId);
    res.json({
      moodCheckIns: { total: moodEntries.length, lastAt: moodEntries.map((e) => e.createdAt).sort().at(-1) ?? null },
      // Metadata only (id/type/dates) - never journal content. See
      // POST /users/:userId/journal-access for the explicit, audited path
      // to actual entry text.
      journalEntries: journalEntries.map((e) => ({ id: e.id, type: e.type, isDraft: e.isDraft, favorite: e.favorite, createdAt: e.createdAt, updatedAt: e.updatedAt })),
      habits: habits.map((h) => ({ id: h.id, name: h.name, active: h.active, createdAt: h.createdAt })),
      goals: goals.map((g) => ({ id: g.id, status: g.status, createdAt: g.createdAt })),
      meditationSessions: { total: meditationSessions.length, completed: meditationSessions.filter((s) => s.completed).length },
      breathingSessions: { total: breathingSessions.length, completed: breathingSessions.filter((s) => s.completed).length },
    });
  });

  // --- Sensitive data access: private journal entry content --------------
  // Deliberately the ONLY place in the whole admin API that returns real
  // journal text. Requires a reason, is restricted to super_admin, and is
  // unconditionally audited (both the request and which entry was opened) -
  // satisfies "explicit access action + reason + audited" rather than ever
  // showing journal content in a table/list by default.
  router.post('/users/:userId/journal-access', requireRole('super_admin'), (req, res) => {
    const userId = resolveUserParam(req.params.userId);
    if (!userId) return res.status(404).json({ error: 'No user found for this ID' });
    const { reason, entryId } = req.body ?? {};
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ error: 'A reason (5+ characters) is required to access private journal content.' });
    }
    const entries = journalEntriesById.valuesForUser(userId).filter((e) => !e.deletedAt && (!entryId || e.id === entryId));
    logAdminAudit({
      adminId: req.admin!.adminId,
      action: 'SENSITIVE_ACCESS_JOURNAL',
      path: req.originalUrl,
      targetType: 'journal_entry',
      targetId: entryId || `all:${userId}`,
      reason: String(reason),
      metadata: { userId, entryCount: entries.length },
    });
    res.json({ entries: entries.map((e) => ({ id: e.id, type: e.type, title: e.title ?? null, content: e.content, tags: e.tags ?? [], createdAt: e.createdAt, updatedAt: e.updatedAt })) });
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

  router.get('/soulmate', (req, res) => {
    const range = parseDateRange(req);
    const rows = [...soulmateSketchesById.values()].filter((s) => inRange(s.createdAt, range));
    const byGenerationStatus: Record<string, number> = {};
    const byStyle: Record<string, number> = {};
    for (const s of rows) {
      byGenerationStatus[s.generationStatus] = (byGenerationStatus[s.generationStatus] ?? 0) + 1;
      byStyle[s.style] = (byStyle[s.style] ?? 0) + 1;
    }
    const events = soulmateAnalyticsEvents.filter((e) => inRange(e.createdAt, range));
    const eventCounts: Record<string, number> = {};
    for (const e of events) eventCounts[e.type] = (eventCounts[e.type] ?? 0) + 1;

    res.json({
      total: rows.length,
      byGenerationStatus,
      byStyle,
      eventCounts,
      // The real recorded-transaction revenue (see data/pricing.ts) is the
      // only revenue figure reported - no separate estimate is fabricated
      // alongside it. Per-call AI image-generation cost is not tracked
      // here since Gemini's image-gen billing is not queryable from this
      // app; wiring that in later only needs a cost field added to
      // SoulmateSketch at generation time, not a change to this endpoint.
      revenue: featureRevenue(range, 'soulmate_sketch'),
    });
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
      errorMonitoring: { available: true, errorsLastHour: errorsLastHour(), note: 'File-backed error log + optional webhook alert (see /admin/errors) - not a full APM/Sentry integration.' },
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

  // --- Pricing (live, admin-editable; no redeploy needed) -------------------
  router.get('/pricing', (_req, res) => {
    res.json({
      pricingTableVersion: PRICING_TABLE_VERSION,
      subscriptionBasePrices: getSubscriptionBasePrices(),
      subscriptionPlans: getSubscriptionPlans(),
      featurePricingCents: getPricingCents(),
      defaults: {
        subscriptionBasePrices: defaultSubscriptionBasePrices(),
        featurePricingCents: defaultPricingCents(),
      },
    });
  });

  router.put('/pricing', requireRole('super_admin'), (req, res) => {
    const body = req.body ?? {};
    const before = { subscriptionBasePrices: getSubscriptionBasePrices(), featurePricingCents: getPricingCents() };
    if (body.subscriptionBasePrices && typeof body.subscriptionBasePrices === 'object') {
      const allowed: Record<string, number> = {};
      for (const k of ['monthlyCents', 'quarterlyCents', 'annualCents']) {
        const v = body.subscriptionBasePrices[k];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) allowed[k] = Math.round(v);
      }
      setSubscriptionBasePrices(allowed);
    }
    if (body.featurePricingCents && typeof body.featurePricingCents === 'object') {
      const allowedKeys: PricedFeature[] = [
        'premium_subscription', 'tarot_detailed_report', 'gemstone_premium_report',
        'vastu_premium_report', 'astrology_premium_report', 'palm_premium_report',
        'palm_section_unlock', 'soulmate_sketch',
      ];
      const allowed: Partial<Record<PricedFeature, number>> = {};
      for (const k of allowedKeys) {
        const v = body.featurePricingCents[k];
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) allowed[k] = Math.round(v);
      }
      setPricingCents(allowed);
    }
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'PRICING_UPDATED', path: req.originalUrl, targetType: 'pricing', metadata: { before, after: { subscriptionBasePrices: getSubscriptionBasePrices(), featurePricingCents: getPricingCents() } } });
    res.json({
      subscriptionBasePrices: getSubscriptionBasePrices(),
      subscriptionPlans: getSubscriptionPlans(),
      featurePricingCents: getPricingCents(),
    });
  });

  // --- AI budget (live, admin-editable) --------------------------------------
  router.get('/ai-budget', (_req, res) => {
    res.json({ caps: getAiBudgetCaps(), defaults: defaultAiBudgetCaps() });
  });

  router.put('/ai-budget', requireRole('super_admin'), (req, res) => {
    const body = req.body ?? {};
    const allowedKeys = ['premiumMonthlyBudgetInr', 'freeMonthlyBudgetInr', 'freeChatDailyMessages', 'freeChatMonthlyInr', 'freeChatDailyPerIp'] as const;
    const before = getAiBudgetCaps();
    const next: Record<string, number> = {};
    for (const k of allowedKeys) {
      const v = body[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) next[k] = v;
    }
    const caps = setAiBudgetCaps(next);
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'AI_BUDGET_UPDATED', path: req.originalUrl, targetType: 'aiBudget', metadata: { before, after: caps } });
    res.json({ caps });
  });

  // --- Feature flags (live, admin-editable) ----------------------------------
  router.get('/feature-flags', (_req, res) => {
    res.json({ flags: getFeatureFlags() });
  });

  router.put('/feature-flags/:key', requireRole('super_admin'), (req, res) => {
    const { key } = req.params;
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean.' });
    const flags = setFeatureFlag(key, enabled);
    if (!flags.some((f) => f.key === key)) return res.status(404).json({ error: `Unknown feature flag: ${key}` });
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'FEATURE_FLAG_UPDATED', path: req.originalUrl, targetType: 'featureFlag', targetId: key, metadata: { enabled } });
    res.json({ flags });
  });

  // --- Admin user (staff) management, super_admin only -----------------------
  router.get('/admins', requireRole('super_admin'), (_req, res) => {
    res.json({ admins: listAdminUsers() });
  });

  router.post('/admins', requireRole('super_admin'), async (req, res) => {
    const { email, password, role } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
    if (typeof password !== 'string' || password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters.' });
    if (!['super_admin', 'analyst', 'viewer'].includes(role)) return res.status(400).json({ error: 'role must be super_admin, analyst, or viewer.' });
    if (findAdminByEmail(email)) return res.status(409).json({ error: 'An admin with that email already exists.' });
    const admin = await createAdminUser(email, password, role);
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'ADMIN_CREATED', path: req.originalUrl, targetType: 'adminUser', targetId: admin.id, metadata: { email: admin.email, role: admin.role } });
    res.json({ id: admin.id, email: admin.email, role: admin.role, status: admin.status });
  });

  router.put('/admins/:id/role', requireRole('super_admin'), (req, res) => {
    const { role } = req.body ?? {};
    if (!['super_admin', 'analyst', 'viewer'].includes(role)) return res.status(400).json({ error: 'role must be super_admin, analyst, or viewer.' });
    const target = findAdminById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Admin not found.' });
    setAdminRole(target.id, role);
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'ADMIN_ROLE_CHANGED', path: req.originalUrl, targetType: 'adminUser', targetId: target.id, metadata: { from: target.role, to: role } });
    res.json({ ok: true });
  });

  router.put('/admins/:id/status', requireRole('super_admin'), (req, res) => {
    const { status } = req.body ?? {};
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ error: 'status must be active or disabled.' });
    const target = findAdminById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Admin not found.' });
    if (target.id === (req as any).admin!.adminId && status === 'disabled') {
      return res.status(400).json({ error: 'You cannot disable your own admin account.' });
    }
    setAdminStatus(target.id, status);
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'ADMIN_STATUS_CHANGED', path: req.originalUrl, targetType: 'adminUser', targetId: target.id, metadata: { status } });
    res.json({ ok: true });
  });

  // --- AI Cost Centre --------------------------------------------------------
  router.get('/ai-cost-centre', (req, res) => {
    const qs = req.query;
    const month = typeof qs.month === 'string' ? qs.month : undefined;
    const events = aiUsageEvents.filter((e) => (month ? e.createdAt.slice(0, 7) === month : true));
    const byFeature: Record<string, { calls: number; estimatedInputTokens: number; estimatedOutputTokens: number }> = {};
    const byDay: Record<string, number> = {};
    for (const e of events) {
      const f = byFeature[e.feature] ?? { calls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 };
      f.calls += 1;
      f.estimatedInputTokens += e.estimatedInputTokens;
      f.estimatedOutputTokens += e.estimatedOutputTokens;
      byFeature[e.feature] = f;
      const day = e.createdAt.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + estimateCostInr(e.estimatedInputTokens, e.estimatedOutputTokens, e.tokenSource === 'actual', providerKeyFromName(e.model));
    }
    const byFeatureWithCost = Object.fromEntries(
      Object.entries(byFeature).map(([feature, v]) => [
        feature,
        { ...v, estimatedCostInr: Math.round(estimateCostInr(v.estimatedInputTokens, v.estimatedOutputTokens) * 100) / 100 },
      ]),
    );
    const topSpenders = listTopAiSpenders(month).map((s) => ({ ...s, costInr: Math.round(s.costInr * 100) / 100 }));
    res.json({
      totalCalls: events.length,
      byFeature: byFeatureWithCost,
      dailyEstimatedCostInr: Object.fromEntries(Object.entries(byDay).map(([d, v]) => [d, Math.round(v * 100) / 100])),
      topSpenders,
      note: 'Cost is estimated (~4 chars/token heuristic unless the provider reported real usage) - never a real bill. Per-user cost comes from the live monthly budget tracker (ai/budget.ts), which is genuinely per-user; the feature/day breakdown above is not (aiUsageEvents carries no userId).',
    });
  });

  // --- API Monitoring ----------------------------------------------------------
  router.get('/api-monitoring', (req, res) => {
    const range = parseDateRange(req);
    res.json(getApiMonitoringOverview(range.since, range.until));
  });

  // --- Alerts & Incidents -------------------------------------------------------
  router.get('/alerts', (_req, res) => {
    res.json({ checks: evaluateAlerts(), thresholds: getAlertThresholds(), incidents: listIncidents() });
  });

  router.put('/alerts/thresholds', requireRole('super_admin'), (req, res) => {
    const body = req.body ?? {};
    const allowed: Record<string, number> = {};
    for (const k of ['errorsPerHour', 'paymentFailureRatePercent', 'soulmateGenerationFailureRatePercent']) {
      if (typeof body[k] === 'number' && Number.isFinite(body[k]) && body[k] >= 0) allowed[k] = body[k];
    }
    const thresholds = setAlertThresholds(allowed);
    const adminId = (req as any).admin!.adminId;
    logAdminAudit({ adminId, action: 'ALERT_THRESHOLDS_UPDATED', path: req.originalUrl, metadata: { thresholds } });
    res.json({ thresholds });
  });

  router.post('/incidents', (req, res) => {
    const { alertKey, label, note } = req.body ?? {};
    if (typeof alertKey !== 'string' || typeof label !== 'string') return res.status(400).json({ error: 'alertKey and label are required.' });
    const adminId = (req as any).admin!.adminId;
    const incident = openIncident(alertKey, label, findAdminById(adminId)?.email ?? adminId, typeof note === 'string' ? note : '');
    logAdminAudit({ adminId, action: 'INCIDENT_OPENED', path: req.originalUrl, targetType: 'incident', targetId: incident.id });
    res.json({ incident });
  });

  router.put('/incidents/:id/resolve', (req, res) => {
    const { note } = req.body ?? {};
    const adminId = (req as any).admin!.adminId;
    const incident = resolveIncident(req.params.id, findAdminById(adminId)?.email ?? adminId, typeof note === 'string' ? note : undefined);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    logAdminAudit({ adminId, action: 'INCIDENT_RESOLVED', path: req.originalUrl, targetType: 'incident', targetId: incident.id });
    res.json({ incident });
  });

  // --- Acquisition, Funnels, Retention (real, event-based) ----------------------
  router.get('/acquisition', (req, res) => {
    const range = parseDateRange(req);
    res.json({
      days: getAcquisitionOverTime(range.since, range.until),
      note: 'New accounts per day (guest vs registered), from real account-creation events. No channel/campaign attribution exists - this app has no referrer/UTM capture.',
    });
  });

  router.get('/funnels', (req, res) => {
    const range = parseDateRange(req);
    const key = typeof req.query.funnel === 'string' ? req.query.funnel : FUNNEL_DEFINITIONS[0].key;
    const steps = getFunnel(key, range.since, range.until);
    if (!steps) return res.status(404).json({ error: `Unknown funnel: ${key}` });
    res.json({ funnels: FUNNEL_DEFINITIONS.map((f) => ({ key: f.key, label: f.label })), selected: key, steps });
  });

  router.get('/retention', (_req, res) => {
    res.json({
      cohorts: getRetentionCohorts(),
      note: 'Weekly cohorts by first account-creation event; "retained" means the cohort member produced ANY event during that later week. A cell is blank (null) only for a week that has not happened yet.',
    });
  });

  return router;
}
