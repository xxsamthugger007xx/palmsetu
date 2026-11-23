import { randomUUID } from 'crypto';
import { PalmReading, DailyPalmGuidance } from '../types/palm';
import { Account, GuestSession, AuthAttemptRecord } from '../types/auth';
import { SoulmateSketch } from '../types/soulmate';
import { DailyTarot, TarotJournalEntry, TarotReading } from '../types/tarot';
import {
  BirthProfile, DailyHoroscope, PartnerInvitation, Relationship, RelationshipConsent,
  RelationshipDailyReport, DailyDeliveryPreference, UserIdentity, OnboardingDraft,
} from '../types/astrology';
import { GemstoneReport } from '../types/gemstone';
import { KundliChart } from '../types/kundli';
import { SoulEnergyReading } from '../types/soulEnergy';
import { PropertyProfile, VastuReport } from '../types/vastu';
import { PRICING_CENTS, CURRENCY, PricedFeature } from './pricing';
import { SqliteMap, persistentArray } from './sqliteCollections';

/** Real, file-based SQLite persistence (server/data/solune.db) - see db.ts
 * and sqliteCollections.ts. Every store below used to be a plain in-memory
 * Map/array that vanished on restart; it is now backed by SQLite while
 * keeping the exact same Map/array call surface, so route files did not
 * need to change how they read/write these. Migrations run on import of
 * db.ts itself (see its bottom), before any store below opens its table. */

export const readingsById = new SqliteMap<string, PalmReading>('readings', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

/** The user's one permanent palm profile reading, if they have completed a
 * scan - palm scanning is a one-time onboarding experience (see
 * routes/palm.ts), so this is at most one reading, never a list. Falls
 * back to the most recent reading when no reading is explicitly flagged
 * isPrimary yet (covers readings created before this flag existed), so
 * pre-existing users are not treated as profile-less just because of the
 * schema change. */
export function primaryReadingFor(userId: string): PalmReading | undefined {
  const mine = readingsById.valuesForUser(userId);
  if (mine.length === 0) return undefined;
  return mine.find((r) => r.isPrimary) ?? mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Marks exactly one reading as the user's primary palm profile, clearing
 * the flag off every other reading of theirs first - enforces "at most one
 * primary profile per user" at the data layer, not just by route-level
 * convention. */
export function setPrimaryReading(userId: string, readingId: string): void {
  for (const r of readingsById.values()) {
    if (r.userId === userId && r.isPrimary && r.id !== readingId) {
      readingsById.set(r.id, { ...r, isPrimary: false });
    }
  }
  const target = readingsById.get(readingId);
  if (target) readingsById.set(readingId, { ...target, isPrimary: true });
}
// key: `${userId}:${localDate}` - one per user per local calendar day, same
// pattern as dailyHoroscopesByKey/dailyTarotByUserDate below.
export const dailyPalmGuidanceByKey = new SqliteMap<string, DailyPalmGuidance>('dailyPalmGuidance');
// Follow-up question count per palm reading, for free-tier limiting (same pattern as gemstone/vastu).
export const palmFollowupCounts = new SqliteMap<string, number>('palmFollowupCounts');

/** Section-wise palm entitlement record: one row per (reading, section)
 * pair that has been unlocked. Key is `${readingId}:${section}` so lookup
 * and uniqueness are both free. `userId` is denormalized onto the record
 * (not just derivable from the reading) so cross-user ownership can be
 * double-checked directly off this table, not only via the parent
 * reading, and so sectionUnlocksUsedBy() can count a user's unlocks
 * without having to join through readingsById. */
export interface PalmSectionUnlockRecord {
  readingId: string;
  userId: string;
  section: string;
  unlockedAt: string;
}
export const palmSectionUnlocks = new SqliteMap<string, PalmSectionUnlockRecord>('palmSectionUnlocks', {
  userId: (v) => v.userId,
});

/** True if this exact reading+section pair has already been unlocked.
 * Used both to short-circuit a repeat "purchase" (never re-charge) and to
 * gate detailed-content reads. */
export function isPalmSectionUnlocked(readingId: string, section: string): boolean {
  return palmSectionUnlocks.has(`${readingId}:${section}`);
}

/** All section keys unlocked for a given reading, regardless of who
 * unlocked them (ownership of the reading itself is already checked by
 * the route before this is called). */
export function unlockedPalmSectionsFor(readingId: string): string[] {
  return [...palmSectionUnlocks.values()]
    .filter((v) => v.readingId === readingId)
    .map((v) => v.section);
}

/** Records one section as unlocked for a reading. Idempotent: unlocking an
 * already-unlocked section just overwrites the same key with a fresh
 * timestamp, never creates a duplicate or double-charges (the route layer
 * checks isPalmSectionUnlocked before calling this to decide whether to
 * charge at all). */
export function unlockPalmSection(readingId: string, userId: string, section: string): void {
  palmSectionUnlocks.set(`${readingId}:${section}`, { readingId, userId, section, unlockedAt: new Date().toISOString() });
}

/** Count of sections a given user has unlocked across ALL their readings -
 * used for the free-tier per-user section-unlock quota, same shape as
 * premiumReportsUsedBy() in routes/palm.ts. */
export function sectionUnlocksUsedBy(userId: string): number {
  return palmSectionUnlocks.valuesForUser(userId).length;
}

export interface MoodCheckIn {
  id: string;
  userId: string;
  mood: number;
  stress: number;
  energy: number;
  notes?: string;
  createdAt: string;
}
export const moodCheckIns: MoodCheckIn[] = persistentArray<MoodCheckIn>('moodCheckIns');

export interface Conversation {
  id: string;
  userId: string;
  mode: 'wellness' | 'palmistry';
  messages: { role: 'user' | 'assistant'; content: string }[];
}
export const conversationsById = new SqliteMap<string, Conversation>('conversations', {
  userId: (v) => v.userId,
});

/** Tarot domain state - see note above on SQLite persistence. */
export const tarotReadingsById = new SqliteMap<string, TarotReading>('tarotReadings', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});
export const tarotJournalById = new SqliteMap<string, TarotJournalEntry>('tarotJournal', {
  userId: (v) => v.userId,
});
// key: `${userId}:${localDate}`
export const dailyTarotByUserDate = new SqliteMap<string, DailyTarot>('dailyTarot');

/** One real event per follow-up question asked - used to enforce the
 * premium-only, server-side daily cap (entitlements.ts's
 * PREMIUM_FOLLOWUP_DAILY_LIMIT) by counting today's events for this user,
 * the same "count real timestamped records since local midnight" approach
 * checkDailyReadingLimit already uses, rather than a separate mutable
 * counter that could drift out of sync with reality. */
export interface TarotFollowupEvent {
  id: string;
  userId: string;
  readingId: string;
  createdAt: string;
}
export const tarotFollowupEvents: TarotFollowupEvent[] = persistentArray<TarotFollowupEvent>('tarotFollowupEvents');

export interface UserPlan {
  userId: string;
  tier: 'free' | 'premium';
  /** Real subscription lifecycle metadata, added alongside the Premium
   * paywall redesign. Now only ever written by routes/billing.ts's
   * POST /billing/confirm-purchase, after server-side verification against
   * RevenueCat's API - the dev-only /dev/set-tier endpoint that used to be
   * the sole writer here has been removed (it was reachable in production).
   * All optional so every pre-existing UserPlan row (tier only) keeps
   * working unchanged. */
  planId?: 'monthly' | 'quarterly' | 'annual';
  productId?: string;
  priceCents?: number;
  currency?: string;
  startedAt?: string;
  renewsAt?: string;
  expiresAt?: string;
  status?: 'active' | 'cancelled' | 'expired';
}
export const userPlans = new SqliteMap<string, UserPlan>('userPlans', {
  userId: (v) => v.userId,
});

export function getUserTier(userId: string): 'free' | 'premium' {
  return userPlans.get(userId)?.tier ?? 'free';
}

/** Astrology / Daily Cosmic Guidance domain state - see note above. */
export const birthProfiles = new SqliteMap<string, BirthProfile>('birthProfiles'); // key: userId
// Identity fields (name, gender) kept separate from BirthProfile - see the
// doc comment on UserIdentity in types/astrology.ts for why. key: userId
export const userIdentities = new SqliteMap<string, UserIdentity>('userIdentities');
// Step-by-step astrology onboarding scratch record - see OnboardingDraft in
// types/astrology.ts for why this exists and why it is safe (never read by
// any real calculation/grounding path, only onboarding-resume logic).
export const onboardingDrafts = new SqliteMap<string, OnboardingDraft>('onboardingDrafts');
// key: `${userId}:${localDate}:${system}`
export const dailyHoroscopesByKey = new SqliteMap<string, DailyHoroscope>('dailyHoroscopes', { userId: (v) => v.userId });
export const astrologyFollowupCounts = new SqliteMap<string, number>('astrologyFollowupCounts'); // key: horoscopeId

export const partnerInvitations = new SqliteMap<string, PartnerInvitation>('partnerInvitations');
export const relationshipsById = new SqliteMap<string, Relationship>('relationships');
export const activeRelationshipByUser = new SqliteMap<string, string>('activeRelationshipByUser'); // userId -> relationshipId
export const relationshipConsents = new SqliteMap<string, RelationshipConsent>('relationshipConsents'); // key: `${relId}:${userId}:${type}`
// key: `${relationshipId}:${localDate}`
export const relationshipDailyReportsByKey = new SqliteMap<string, RelationshipDailyReport>('relationshipDailyReports');
export const deliveryPreferences = new SqliteMap<string, DailyDeliveryPreference>('deliveryPreferences'); // key: userId

// Kundli (Vedic chart) generations - see note above on SQLite persistence.
export const kundliChartsById = new SqliteMap<string, KundliChart>('kundliCharts', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});
// AI soul-energy personality readings, keyed by userId:localDate (one per day, like dailyHoroscopesByKey).
export const soulEnergyReadingsByKey = new SqliteMap<string, SoulEnergyReading>('soulEnergyReadings', { userId: (v) => v.userId });

/** Gemstone recommendation domain state - see note above. */
export const gemstoneReportsById = new SqliteMap<string, GemstoneReport>('gemstoneReports', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});
export const gemstoneFollowupCounts = new SqliteMap<string, number>('gemstoneFollowupCounts'); // key: reportId

/** Vastu Compass domain state - see note above. */
export const vastuPropertiesById = new SqliteMap<string, PropertyProfile>('vastuProperties', { userId: (v) => v.userId });
export const vastuReportsById = new SqliteMap<string, VastuReport>('vastuReports', {
  userId: (v) => v.userId,
  createdAt: (v) => v.createdAt,
});
export const vastuFollowupCounts = new SqliteMap<string, number>('vastuFollowupCounts'); // key: reportId

/**
 * Real transaction ledger, grounded in actual premium-unlock events that
 * happen in this app. See server/src/data/pricing.ts for the full honesty
 * disclaimer: these amounts come from an assumed/test price list, not a real
 * payment gateway, because there isn't one. Each row is written exactly once
 * per premium unlock (see the call sites in routes/tarot.ts, gemstone.ts,
 * vastu.ts and index.ts's /dev/set-tier) so retries/idempotent re-fetches
 * never double-count.
 */
export interface Transaction {
  id: string;
  userId: string;
  feature: PricedFeature;
  amountCents: number;
  currency: string;
  createdAt: string;
}
export const transactions: Transaction[] = persistentArray<Transaction>('transactions');

/** Appends one real transaction row, priced from the assumed/test table in
 * pricing.ts. Call this exactly once per premium unlock, never speculatively. */
/** `amountCentsOverride` is only for callers that already know the exact
 * real price of a specific SKU variant (e.g. /dev/set-tier recording one of
 * the three real subscription plan prices) rather than the single flat
 * price PRICING_CENTS has for that feature key. Omit it everywhere else. */
export function recordTransaction(userId: string, feature: PricedFeature, amountCentsOverride?: number): Transaction {
  const tx: Transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    userId,
    feature,
    amountCents: amountCentsOverride ?? PRICING_CENTS[feature],
    currency: CURRENCY,
    createdAt: new Date().toISOString(),
  };
  transactions.push(tx);
  return tx;
}

/**
 * Centralized AI assistant domain state (server/src/assistant/*, mounted at
 * /assistant). Deliberately separate from `conversationsById` above, which
 * belongs to the narrower wellness/palmistry companion feature.
 */
export type AssistantFeature = 'tarot' | 'astrology' | 'gemstone' | 'vastu' | 'palm' | 'unknown';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  detectedFeature?: AssistantFeature | null;
  premiumCard?: unknown | null;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  userId: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}
export const assistantConversationsById = new SqliteMap<string, AssistantConversation>('assistantConversations', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

/**
 * Usage log for the assistant, one row per /assistant/message call. Token
 * counts and cost are rough ESTIMATES only - there is no real token metering
 * anywhere in this codebase (same honesty caveat as pricing.ts). See
 * server/src/assistant/responseBuilder.ts for the estimation method.
 */
export interface AssistantUsageLogEntry {
  id: string;
  userId: string;
  conversationId: string;
  detectedFeature: AssistantFeature | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostCents: number;
  latencyMs: number;
  success: boolean;
  premiumCardShown: boolean;
  createdAt: string;
  intentDetectionMs?: number;
  dataRetrievalMs?: number;
  timeToFirstTokenMs?: number;
  generationMs?: number;
  mode?: 'fast' | 'deep_analysis' | 'premium_report' | null;
}
export const assistantUsageLog: AssistantUsageLogEntry[] = persistentArray<AssistantUsageLogEntry>('assistantUsageLog', { maxInMemory: 20000 });

export interface AdminAuditEntry {
  id: string;
  role: string;
  action: string;
  path: string;
  createdAt: string;
}
export const adminAuditLog: AdminAuditEntry[] = persistentArray<AdminAuditEntry>('adminAuditLog');

/** Wellness module state - see types/wellness.ts. Same SQLite-backed Map/
 * array pattern as every store above. */
import {
  MoodEntry, JournalEntry, BreathingSession, Habit, HabitCompletion, ChallengeProgress,
  MeditationSession, WellnessGoal, InspirationHistory, WellnessFavorites,
  WellnessNotificationPreferences, WellnessAiConversation, WellnessAnalyticsEvent,
  DiscoveryAnswer, DiscoveryQuestionSelection, WeeklyReport, MonthlyReport,
} from '../types/wellness';

// key: `${userId}:${localDate}` - one check-in per user per local day, same
// idempotent-per-day pattern as dailyTarotByUserDate.
export const moodEntriesByUserDate = new SqliteMap<string, MoodEntry>('moodEntries', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

export const journalEntriesById = new SqliteMap<string, JournalEntry>('journalEntries', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

export const breathingSessionsById = new SqliteMap<string, BreathingSession>('breathingSessions', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

export const habitsById = new SqliteMap<string, Habit>('habits', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

// key: `${habitId}:${localDate}`
export const habitCompletionsByKey = new SqliteMap<string, HabitCompletion>('habitCompletions', {
  userId: (v) => v.userId,
});

// key: `${userId}:${challengeId}`
export const challengeProgressByKey = new SqliteMap<string, ChallengeProgress>('challengeProgress', {
  userId: (v) => v.userId,
});

export const meditationSessionsById = new SqliteMap<string, MeditationSession>('meditationSessions', {
  userId: (v) => v.userId,
});

export const wellnessGoalsById = new SqliteMap<string, WellnessGoal>('wellnessGoals', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

// key: userId
export const inspirationHistoryByUser = new SqliteMap<string, InspirationHistory>('inspirationHistory', {
  userId: (v) => v.userId,
});

// key: userId
export const wellnessFavoritesByUser = new SqliteMap<string, WellnessFavorites>('wellnessFavorites', {
  userId: (v) => v.userId,
});

// key: userId - mirrors deliveryPreferences in astrology.ts exactly.
export const wellnessPreferencesByUser = new SqliteMap<string, WellnessNotificationPreferences>('wellnessPreferences', {
  userId: (v) => v.userId,
});

export const wellnessAiConversationsById = new SqliteMap<string, WellnessAiConversation>('wellnessAiConversations', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

/** Analytics events: metadata-only, never free text - see types/wellness.ts
 * doc comment on WellnessAnalyticsEvent and wellness/analytics.ts. */
export const wellnessAnalyticsEvents: WellnessAnalyticsEvent[] = persistentArray<WellnessAnalyticsEvent>('wellnessAnalyticsEvents', { maxInMemory: 20000 });

/** Daily Discovery state - see types/wellness.ts and
 * wellness/discoveryQuestions.ts. Same SQLite-backed Map pattern as above. */
// key: `${userId}:${localDate}:${questionId}` - upsert-in-place per question per day.
export const discoveryAnswersByKey = new SqliteMap<string, DiscoveryAnswer>('discoveryAnswers', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

// key: `${userId}:${localDate}` - caches today's rotating question subset.
export const discoveryQuestionSelectionsByKey = new SqliteMap<string, DiscoveryQuestionSelection>('discoveryQuestionSelections', {
  userId: (v) => v.userId,
});

// key: `${userId}:${weekStart}` - cached, generated-once-per-week report.
export const weeklyReportsByKey = new SqliteMap<string, WeeklyReport>('weeklyReports', {
  userId: (v) => v.userId,
});

// key: `${userId}:${month}` - cached, generated-once-per-month report.
export const monthlyReportsByKey = new SqliteMap<string, MonthlyReport>('monthlyReports', {
  userId: (v) => v.userId,
});

// ---------------------------------------------------------------------
// Authentication: real accounts, guest sessions, and basic rate limiting.
// See auth/ for the JWT/password/Turnstile logic that uses these stores.
// ---------------------------------------------------------------------

export const accountsById = new SqliteMap<string, Account>('accounts');
export const guestSessionsById = new SqliteMap<string, GuestSession>('guestSessions');
export const authAttempts = new SqliteMap<string, AuthAttemptRecord>('authAttempts');

/** One row per outstanding email-verification link, keyed by the random
 * token embedded in that link (see auth/emailVerification.ts). Consumed
 * (deleted) the moment it is successfully used, so a link only ever works
 * once. */
export interface EmailVerificationRecord {
  token: string;
  accountId: string;
  expiresAt: string;
}
/** One row per user per local calendar day they opened the app (key `${userId}:${localDate}`). Drives the streak. */
export interface DailyActivity { userId: string; localDate: string; createdAt: string }
export const dailyActivityByKey = new SqliteMap<string, DailyActivity>('dailyActivity', { userId: (v) => v.userId, createdAt: (v) => v.createdAt });

/** Logout/revoked session tokens (by JWT id) until they would have expired anyway. */
export const revokedTokens = new SqliteMap<string, { jti: string; exp: number }>('revokedTokens');
export const passwordResetsByHash = new SqliteMap<string, import('../types/auth').PasswordResetRecord>('passwordResets');

export const emailVerificationsByToken = new SqliteMap<string, EmailVerificationRecord>('emailVerifications');

/** Case-insensitive account lookup by email, done in SQL on an expression index (login/signup hot path). */
export function findAccountByEmail(email: string): Account | undefined {
  const normalized = email.trim().toLowerCase();
  return accountsById.findOneByField('email', normalized);
}

export function createGuestSession(id: string): GuestSession {
  const session: GuestSession = { id, createdAt: new Date().toISOString(), migratedAt: null, migratedToUserId: null };
  guestSessionsById.set(id, session);
  return session;
}

// ---------------------------------------------------------------------
// Soulmate Sketch (see types/soulmate.ts, soulmate/, routes/soulmate.ts).
// ---------------------------------------------------------------------

export const soulmateSketchesById = new SqliteMap<string, SoulmateSketch>('soulmateSketches', {
  userId: (v) => v.userId, createdAt: (v) => v.createdAt,
});

export interface SoulmateAnalyticsEvent {
  id: string;
  userId: string;
  type:
    | 'page_viewed' | 'questionnaire_started' | 'questionnaire_completed'
    | 'free_trial_started' | 'free_trial_already_used'
    | 'payment_attempted' | 'payment_succeeded' | 'payment_failed'
    | 'generation_attempted' | 'generation_failed' | 'generation_completed'
    | 'share_event';
  createdAt: string;
  data: Record<string, string | number | boolean>;
}
export const soulmateAnalyticsEvents: SoulmateAnalyticsEvent[] = persistentArray<SoulmateAnalyticsEvent>('soulmateAnalyticsEvents', { maxInMemory: 20000 });

/** True if this exact Razorpay payment id has already been applied to a
 * sketch - a payment id must never be accepted twice, whether that's a
 * retried client request or an attempt to replay the same payment against
 * a different sketch. */
export function isPaymentIdUsed(paymentId: string): boolean {
  return [...soulmateSketchesById.values()].some((s) => s.paymentId === paymentId);
}

/**
 * The user's one free-trial sketch, if one has ever been started -
 * regardless of its current status. This is the entire enforcement
 * mechanism for "one free sketch per user": as long as any isFreeTrial
 * record exists, no second free sketch can be created. A 'failed' free
 * sketch is still returned here on purpose - the retry path reuses this
 * exact record rather than ever creating a second free one.
 */
export function freeTrialSketchFor(userId: string): SoulmateSketch | undefined {
  return soulmateSketchesById.valuesForUser(userId).find((s) => s.isFreeTrial);
}

// ---------------------------------------------------------------------
// Shared, feature-agnostic AI usage log - see ai/usageTracking.ts's
// UsageTrackingProvider, which is the single wrapper around the app-wide
// aiProvider instance (index.ts) that writes every entry here, for every
// feature that calls aiProvider.complete()/streamComplete(), not just
// Tarot. Intentionally generic (feature/operation strings rather than a
// closed enum) so a new feature never needs its own tracking table.
// ---------------------------------------------------------------------

export interface AiUsageEvent {
  id: string;
  feature: string; // e.g. 'tarot', 'palm', 'astrology', 'assistant', 'soulmate_sketch'
  operation: string; // e.g. 'detailed_report', 'followup', 'daily_horoscope'
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  latencyMs: number;
  success: boolean;
  /** 'actual' = provider-reported token counts; 'estimated' = ~4 chars/token guess. */
  tokenSource?: 'actual' | 'estimated';
  createdAt: string;
}

export const aiUsageEvents: AiUsageEvent[] = persistentArray<AiUsageEvent>('aiUsageEvents', { maxInMemory: 20000 });

export function recordAiUsage(event: Omit<AiUsageEvent, 'id' | 'createdAt'>): void {
  aiUsageEvents.push({ ...event, id: randomUUID(), createdAt: new Date().toISOString() });
}
