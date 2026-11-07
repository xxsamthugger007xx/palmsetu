import {
  tarotReadingsById, birthProfiles, dailyHoroscopesByKey, gemstoneReportsById,
  vastuReportsById, readingsById, AssistantFeature,
} from '../data/store';
import { TarotReading } from '../types/tarot';
import { BirthProfile, DailyHoroscope } from '../types/astrology';
import { GemstoneReport } from '../types/gemstone';
import { VastuReport } from '../types/vastu';
import { PalmReading } from '../types/palm';

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
}

function latestOf<T extends { userId: string; createdAt: string }>(map: { values(): T[] }, userId: string): T | null {
  const rows = [...map.values()].filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows[0] ?? null;
}

function recentOf<T extends { userId: string; createdAt: string }>(map: { values(): T[] }, userId: string, limit: number): T[] {
  return [...map.values()].filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

function latestHoroscopeFor(userId: string): DailyHoroscope | null {
  const rows = [...dailyHoroscopesByKey.values()]
    .filter((h) => h.userId === userId)
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
  switch (feature) {
    case 'tarot': return { ...EMPTY, tarot: latestOf(tarotReadingsById, userId), tarotRecent: recentOf(tarotReadingsById, userId, 2) };
    case 'astrology': return { ...EMPTY, astrology: { profile: birthProfiles.get(userId) ?? null, latestHoroscope: latestHoroscopeFor(userId) } };
    case 'gemstone': return { ...EMPTY, gemstone: latestOf(gemstoneReportsById, userId) };
    case 'vastu': return { ...EMPTY, vastu: latestOf(vastuReportsById, userId) };
    case 'palm': return { ...EMPTY, palm: latestOf(readingsById, userId), palmRecent: recentOf(readingsById, userId, 2) };
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
