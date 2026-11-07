import { KnowledgeEntry } from './types';
import { HEART_LINE_ENTRIES } from './heartLine';
import { HEAD_LINE_ENTRIES } from './headLine';
import { LIFE_LINE_ENTRIES } from './lifeLine';
import { FATE_LINE_ENTRIES } from './fateLine';
import { MINOR_LINE_ENTRIES } from './minorLines';
import { MOUNT_ENTRIES } from './mounts';
import { FINGER_ENTRIES } from './fingers';
import { NAIL_ENTRIES } from './nails';
import { HAND_SHAPE_ENTRIES } from './handShape';
import { MARKING_ENTRIES } from './markings';

/**
 * Central read API over the Answer Book. Today the knowledge base is loaded
 * from in-process TS data files at boot (no DB table, no admin UI in this
 * pass - see the follow-up note in the memory file). This service is
 * deliberately the *only* place other code reads knowledge entries from, so
 * a future admin CRUD layer could swap the TS-file source for a DB-backed
 * one (reading from a table instead of these imports) without any caller
 * of this file needing to change.
 */

const ALL_ENTRIES: KnowledgeEntry[] = [
  ...HEART_LINE_ENTRIES,
  ...HEAD_LINE_ENTRIES,
  ...LIFE_LINE_ENTRIES,
  ...FATE_LINE_ENTRIES,
  ...MINOR_LINE_ENTRIES,
  ...MOUNT_ENTRIES,
  ...FINGER_ENTRIES,
  ...NAIL_ENTRIES,
  ...HAND_SHAPE_ENTRIES,
  ...MARKING_ENTRIES,
];

export const KNOWLEDGE_BASE_VERSION = 'kb-1.0';

const REQUIRED_STRING_FIELDS: (keyof KnowledgeEntry)[] = [
  'featureId', 'category', 'featureName', 'location', 'visualDescription',
  'detectionCriteria', 'traditionalMeaning', 'personalityInterpretation',
  'emotionalInterpretation', 'relationshipInterpretation', 'freeReading',
  'premiumReading', 'limitations', 'version',
];

function validateKnowledgeBase(entries: KnowledgeEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.featureId)) {
      throw new Error(`Duplicate knowledge-base feature_id: ${entry.featureId}`);
    }
    seen.add(entry.featureId);

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = entry[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Knowledge-base entry ${entry.featureId} is missing required field: ${field}`);
      }
    }
    if (!Array.isArray(entry.strengths) || !Array.isArray(entry.challenges)) {
      throw new Error(`Knowledge-base entry ${entry.featureId} is missing strengths/challenges arrays`);
    }
    if (typeof entry.confidenceThreshold !== 'number' || entry.confidenceThreshold < 0 || entry.confidenceThreshold > 1) {
      throw new Error(`Knowledge-base entry ${entry.featureId} has an invalid confidenceThreshold`);
    }
  }
}

// Validate once at module load (boot time), so a content bug fails fast
// instead of surfacing as a confusing runtime error deep in a report.
validateKnowledgeBase(ALL_ENTRIES);

const BY_ID = new Map<string, KnowledgeEntry>(ALL_ENTRIES.map((e) => [e.featureId, e]));

export function getKnowledgeEntry(featureId: string): KnowledgeEntry | undefined {
  return BY_ID.get(featureId);
}

export function getAllKnowledgeEntries(): readonly KnowledgeEntry[] {
  return ALL_ENTRIES;
}

export function getKnowledgeEntriesByCategory(category: KnowledgeEntry['category']): KnowledgeEntry[] {
  return ALL_ENTRIES.filter((e) => e.category === category);
}

export function knowledgeBaseEntryCount(): number {
  return ALL_ENTRIES.length;
}
