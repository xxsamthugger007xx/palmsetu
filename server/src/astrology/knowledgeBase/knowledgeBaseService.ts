import { AstrologyKnowledgeEntry, AstrologySystemId } from './types';
import { VEDIC_RASHI_ENTRIES } from './vedicRashis';
import { VEDIC_NAKSHATRA_ENTRIES } from './vedicNakshatras';
import { VEDIC_GRAHA_ENTRIES } from './vedicGrahas';
import { VEDIC_BHAVA_ENTRIES } from './vedicBhavas';
import { VEDIC_DASHA_ENTRIES } from './vedicDashas';
import { VEDIC_CONCEPT_ENTRIES } from './vedicConcepts';
import { WESTERN_SIGN_ENTRIES } from './westernSigns';
import { WESTERN_HOUSE_ENTRIES } from './westernHouses';
import { WESTERN_PLANET_ENTRIES } from './westernPlanets';
import { WESTERN_ASPECT_ENTRIES } from './westernAspects';
import { WESTERN_CONCEPT_ENTRIES } from './westernConcepts';

/**
 * Central read API over the astrology "Answer Book", mirroring
 * server/src/palmistry/knowledgeBase/knowledgeBaseService.ts exactly:
 * real researched traditional content, loaded from in-process TS data
 * files at boot (no DB table, no admin UI in this pass), validated once at
 * module load so a content bug fails fast. This is deliberately the only
 * place other code reads astrology knowledge entries from.
 */
const ALL_ENTRIES: AstrologyKnowledgeEntry[] = [
  ...VEDIC_RASHI_ENTRIES,
  ...VEDIC_NAKSHATRA_ENTRIES,
  ...VEDIC_GRAHA_ENTRIES,
  ...VEDIC_BHAVA_ENTRIES,
  ...VEDIC_DASHA_ENTRIES,
  ...VEDIC_CONCEPT_ENTRIES,
  ...WESTERN_SIGN_ENTRIES,
  ...WESTERN_HOUSE_ENTRIES,
  ...WESTERN_PLANET_ENTRIES,
  ...WESTERN_ASPECT_ENTRIES,
  ...WESTERN_CONCEPT_ENTRIES,
];

export const ASTROLOGY_KNOWLEDGE_BASE_VERSION = 'kb-astro-1.0';

const REQUIRED_STRING_FIELDS: (keyof AstrologyKnowledgeEntry)[] = [
  'featureId', 'category', 'system', 'name', 'summary', 'detailed', 'limitations', 'sourceType', 'version',
];

function validateKnowledgeBase(entries: AstrologyKnowledgeEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.featureId)) {
      throw new Error(`Duplicate astrology knowledge-base feature_id: ${entry.featureId}`);
    }
    seen.add(entry.featureId);

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = entry[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Astrology knowledge-base entry ${entry.featureId} is missing required field: ${field}`);
      }
    }
    if (!Array.isArray(entry.aliases)) {
      throw new Error(`Astrology knowledge-base entry ${entry.featureId} is missing an aliases array`);
    }
  }
}

validateKnowledgeBase(ALL_ENTRIES);

const BY_ID = new Map<string, AstrologyKnowledgeEntry>(ALL_ENTRIES.map((e) => [e.featureId, e]));

export function getAstrologyKnowledgeEntry(featureId: string): AstrologyKnowledgeEntry | undefined {
  return BY_ID.get(featureId);
}

export function getAllAstrologyKnowledgeEntries(): readonly AstrologyKnowledgeEntry[] {
  return ALL_ENTRIES;
}

export function getAstrologyKnowledgeEntriesByCategory(category: AstrologyKnowledgeEntry['category']): AstrologyKnowledgeEntry[] {
  return ALL_ENTRIES.filter((e) => e.category === category);
}

export function astrologyKnowledgeBaseEntryCount(): number {
  return ALL_ENTRIES.length;
}

/**
 * Normalizes a free-text topic string for matching against entry name/
 * aliases: lowercase, trimmed, with "house"/"bhava" ordinal punctuation
 * (e.g. "7th") kept, since both numeric-house entries key on it.
 */
function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * System-aware lookup: given a free-text topic (a sign/rashi name, a house/
 * bhava number or phrase, a planet/graha name, a nakshatra name, a dasha
 * lord, or a concept phrase) and the user's preferred astrology system,
 * returns the correctly system-framed knowledge entry.
 *
 * Deterministic matching only - no AI involved in this lookup, same
 * "retrieval first" rule as staticPalmistryEngine.ts. Returns undefined
 * (an honest "not found" signal) when nothing in the knowledge base
 * matches, rather than ever fabricating or guessing a result.
 */
export function getAstrologyKnowledge(topic: string, system: AstrologySystemId): AstrologyKnowledgeEntry | undefined {
  const needle = normalizeTopic(topic);
  if (!needle) return undefined;

  const candidates = ALL_ENTRIES.filter((e) => e.system === system);

  // Exact name/alias match first (most reliable).
  for (const e of candidates) {
    if (normalizeTopic(e.name) === needle) return e;
    if (e.aliases.some((a) => normalizeTopic(a) === needle)) return e;
  }

  // Substring match (e.g. "tell me about scorpio" contains "scorpio").
  for (const e of candidates) {
    if (e.aliases.some((a) => needle.includes(normalizeTopic(a)))) return e;
    if (needle.includes(normalizeTopic(e.name))) return e;
  }

  return undefined;
}
