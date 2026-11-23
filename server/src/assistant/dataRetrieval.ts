import { journalDay } from '../types/wellness';
import {
  tarotReadingsById, birthProfiles, dailyHoroscopesByKey, gemstoneReportsById,
  vastuReportsById, readingsById, AssistantFeature,
  moodEntriesByUserDate, discoveryAnswersByKey, habitsById,
  challengeProgressByKey, wellnessGoalsById, journalEntriesById,
} from '../data/store';
import { TarotReading } from '../types/tarot';
import { BirthProfile, DailyHoroscope } from '../types/astrology';
import { GemstoneReport } from '../types/gemstone';
import { VastuReport } from '../types/vastu';
import { PalmReading } from '../types/palm';
import { findDiscoveryQuestion } from '../wellness/discoveryQuestions';

/**
 * Real user data retrieval for the assistant. Every lookup here reads from
 * the same stores the feature routes themselves use, scoped to userId, and
 * never fabricates a result - a missing record is reported as `null`/empty,
 * never invented.
 */
export interface UserFeatureData {
  tarot: TarotReading | null;
  /** The user's most recent tarot readings, newest first, up to 2 - added
   * specifically to support "compare my last two readings"-style questions.
   * This is a minimal, additive extension (same store, same sort, just not
   * truncated to 1) rather than a restructure: the other four features still
   * only expose their single latest record, since no comparison request was
   * scoped for them. */
  tarotRecent: TarotReading[];
  astrology: { profile: BirthProfile | null; latestHoroscope: ReturnType<typeof latestHoroscopeFor> };
  gemstone: GemstoneReport | null;
  vastu: VastuReport | null;
  palm: PalmReading | null;
  /** The user's most recent palm readings, newest first, up to 2 - same
   * additive extension as tarotRecent above, added specifically so the
   * assistant can answer "compare my last two palm readings"-style
   * questions using only free-tier-safe data (section titles/text, never
   * premium report text). */
  palmRecent: PalmReading[];
  /** Real wellness summary (Part 7 of the wellness spec - closes the
   * previously-named gap where this assistant had no wellness context at
   * all). Deliberately SUMMARY-ONLY: mood levels/counts, discovery answer
   * CATEGORIES (never raw free-text content), habit/challenge/goal status.
   * Raw journal text is NEVER included here, mirroring the exact
   * consent-gated rule already enforced in routes/wellness.ts's journal
   * AI-insight endpoint (consent must be explicit per-request there; here,
   * there is no consent flow at all, so journal content is simply never
   * retrieved for this automatic context, only a count). */
  wellness: WellnessSummary;
}

export interface WellnessSummary {
  hasAnyData: boolean;
  recentMoods: { localDate: string; mood: string }[]; // last 14 real check-ins
  recentDiscoveryThemes: string[]; // category labels only from last 14 days' mood-influence answers, never free text
  activeHabitNames: string[];
  activeChallenges: { challengeId: string; currentDay: number }[];
  activeGoalTitles: string[];
  journalEntryCountLast30Days: number; // count only - never content
}

function buildWellnessSummary(userId: string): WellnessSummary {
  const moods = moodEntriesByUserDate.valuesForUser(userId)
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .slice(0, 14)
    .map((m) => ({ localDate: m.localDate, mood: m.mood }));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recentDiscoveryThemes = new Set<string>();
  for (const a of discoveryAnswersByKey.values()) {
    if (a.userId !== userId || a.skipped || a.localDate < cutoffStr) continue;
    const q = findDiscoveryQuestion(a.questionId);
    if (q?.category === 'mood-influences' && Array.isArray(a.value)) {
      for (const label of a.value as string[]) recentDiscoveryThemes.add(label);
    }
  }

  const activeHabitNames = habitsById.valuesForUser(userId).filter((h) => h.active).map((h) => h.name);
  const activeChallenges = challengeProgressByKey.valuesForUser(userId)
    .filter((c) => c.status === 'active')
    .map((c) => ({ challengeId: c.challengeId, currentDay: c.currentDay }));
  const activeGoalTitles = wellnessGoalsById.valuesForUser(userId).filter((g) => g.status === 'active').map((g) => g.title);

  const journalCutoff = new Date();
  journalCutoff.setDate(journalCutoff.getDate() - 30);
  const journalCutoffStr = journalCutoff.toISOString().slice(0, 10);
  const journalEntryCountLast30Days = [...journalEntriesById.values()].filter(
    (j) => j.userId === userId && !j.deletedAt && !j.isDraft && journalDay(j) >= journalCutoffStr,
  ).length;

  const hasAnyData = moods.length > 0 || recentDiscoveryThemes.size > 0 || activeHabitNames.length > 0
    || activeChallenges.length > 0 || activeGoalTitles.length > 0 || journalEntryCountLast30Days > 0;

  return {
    hasAnyData,
    recentMoods: moods,
    recentDiscoveryThemes: [...recentDiscoveryThemes],
    activeHabitNames,
    activeChallenges,
    activeGoalTitles,
    journalEntryCountLast30Days,
  };
}

function latestOf<T extends { userId: string; createdAt: string }>(map: { valuesForUser(userId: string): T[] }, userId: string): T | null {
  const rows = map.valuesForUser(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows[0] ?? null;
}

function recentOf<T extends { userId: string; createdAt: string }>(map: { valuesForUser(userId: string): T[] }, userId: string, limit: number): T[] {
  return map.valuesForUser(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

function latestHoroscopeFor(userId: string): DailyHoroscope | null {
  const rows = dailyHoroscopesByKey.valuesForUser(userId)
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
  return rows[0] ?? null;
}

const EMPTY: UserFeatureData = {
  tarot: null,
  tarotRecent: [],
  astrology: { profile: null, latestHoroscope: null },
  gemstone: null,
  vastu: null,
  palm: null,
  palmRecent: [],
  wellness: {
    hasAnyData: false, recentMoods: [], recentDiscoveryThemes: [], activeHabitNames: [],
    activeChallenges: [], activeGoalTitles: [], journalEntryCountLast30Days: 0,
  },
};

export function retrieveUserData(userId: string): UserFeatureData {
  return {
    tarot: latestOf(tarotReadingsById, userId),
    tarotRecent: recentOf(tarotReadingsById, userId, 2),
    astrology: { profile: birthProfiles.get(userId) ?? null, latestHoroscope: latestHoroscopeFor(userId) },
    gemstone: latestOf(gemstoneReportsById, userId),
    vastu: latestOf(vastuReportsById, userId),
    palm: latestOf(readingsById, userId),
    palmRecent: recentOf(readingsById, userId, 2),
    wellness: buildWellnessSummary(userId),
  };
}

/**
 * Speed optimization: once the feature is already known (the common case,
 * since heuristic intent detection resolves before any data lookup), there
 * is no reason to scan all five in-memory stores - only the one store the
 * detected feature actually needs. Falls back to the full retrieval only
 * when the feature itself is still unresolved ('unknown'), since in that
 * case the caller may need to know what data exists across features (e.g.
 * for default follow-up suggestions).
 */
export function retrieveUserDataForFeature(feature: AssistantFeature, userId: string): UserFeatureData {
  // Wellness context is cheap to compute (a handful of small in-memory
  // lookups) and is included regardless of which feature was detected -
  // this is what lets "how have I been feeling this month" or "what's been
  // stressing me recently" work even when the heuristic intent detector did
  // not specifically classify the message as a 'wellness' feature (no such
  // AssistantFeature branch exists yet - adding one would mean touching the
  // intent classifier, which is out of scope here; always including this
  // summary is the minimal, additive way to close the gap without that).
  const wellness = buildWellnessSummary(userId);
  switch (feature) {
    case 'tarot': return { ...EMPTY, wellness, tarot: latestOf(tarotReadingsById, userId), tarotRecent: recentOf(tarotReadingsById, userId, 2) };
    case 'astrology': return { ...EMPTY, wellness, astrology: { profile: birthProfiles.get(userId) ?? null, latestHoroscope: latestHoroscopeFor(userId) } };
    case 'gemstone': return { ...EMPTY, wellness, gemstone: latestOf(gemstoneReportsById, userId) };
    case 'vastu': return { ...EMPTY, wellness, vastu: latestOf(vastuReportsById, userId) };
    case 'palm': return { ...EMPTY, wellness, palm: latestOf(readingsById, userId), palmRecent: recentOf(readingsById, userId, 2) };
    default: return retrieveUserData(userId);
  }
}

/** Whether the user has any real data at all for a given detected feature. */
export function hasDataFor(feature: AssistantFeature, data: UserFeatureData): boolean {
  switch (feature) {
    case 'tarot': return !!data.tarot;
    case 'astrology': return !!data.astrology.profile;
    case 'gemstone': return !!data.gemstone;
    case 'vastu': return !!data.vastu;
    case 'palm': return !!data.palm;
    default: return false;
  }
}
