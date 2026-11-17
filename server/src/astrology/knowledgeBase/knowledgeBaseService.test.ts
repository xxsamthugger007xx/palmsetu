import { describe, expect, it } from 'vitest';
import {
  getAllAstrologyKnowledgeEntries, getAstrologyKnowledgeEntriesByCategory,
  getAstrologyKnowledgeEntry, astrologyKnowledgeBaseEntryCount, getAstrologyKnowledge,
} from './knowledgeBaseService';

describe('astrology knowledgeBaseService', () => {
  it('loads a substantial number of entries with no duplicate feature_ids', () => {
    const entries = getAllAstrologyKnowledgeEntries();
    expect(astrologyKnowledgeBaseEntryCount()).toBe(entries.length);
    expect(entries.length).toBeGreaterThanOrEqual(100);

    const ids = entries.map((e) => e.featureId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty required fields', () => {
    for (const entry of getAllAstrologyKnowledgeEntries()) {
      expect(entry.featureId.length).toBeGreaterThan(0);
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.summary.trim().length).toBeGreaterThan(0);
      expect(entry.detailed.trim().length).toBeGreaterThan(0);
      expect(entry.limitations.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(entry.aliases)).toBe(true);
    }
  });

  it('covers all 12 Rashis, 27 Nakshatras, 9 Grahas, 12 Bhavas, 9 Dashas (Vedic)', () => {
    expect(getAstrologyKnowledgeEntriesByCategory('vedicRashi').length).toBe(12);
    expect(getAstrologyKnowledgeEntriesByCategory('vedicNakshatra').length).toBe(27);
    expect(getAstrologyKnowledgeEntriesByCategory('vedicGraha').length).toBe(9);
    expect(getAstrologyKnowledgeEntriesByCategory('vedicBhava').length).toBe(12);
    expect(getAstrologyKnowledgeEntriesByCategory('vedicDasha').length).toBe(9);
  });

  it('covers all 12 tropical signs, 12 houses, 10 planets, 5 major aspects (Western)', () => {
    expect(getAstrologyKnowledgeEntriesByCategory('westernSign').length).toBe(12);
    expect(getAstrologyKnowledgeEntriesByCategory('westernHouse').length).toBe(12);
    expect(getAstrologyKnowledgeEntriesByCategory('westernPlanet').length).toBe(10);
    expect(getAstrologyKnowledgeEntriesByCategory('westernAspect').length).toBe(5);
  });

  it('getAstrologyKnowledgeEntry returns undefined for an unknown id rather than fabricating one', () => {
    expect(getAstrologyKnowledgeEntry('not-a-real-feature-id')).toBeUndefined();
  });

  it('getAstrologyKnowledge("scorpio", "vedic") and ("scorpio", "western") return genuinely different, system-framed content', () => {
    const vedic = getAstrologyKnowledge('scorpio', 'vedic');
    const western = getAstrologyKnowledge('scorpio', 'western');
    expect(vedic).toBeDefined();
    expect(western).toBeDefined();
    expect(vedic!.featureId).not.toBe(western!.featureId);
    expect(vedic!.system).toBe('vedic');
    expect(western!.system).toBe('western');
    expect(vedic!.detailed).not.toBe(western!.detailed);
    expect(vedic!.name.toLowerCase()).toContain('vrishchika');
    expect(western!.name.toLowerCase()).toBe('scorpio');
  });

  it('getAstrologyKnowledge matches by house number phrase and by nakshatra/dasha name', () => {
    expect(getAstrologyKnowledge('7th house', 'western')?.featureId).toBe('western-house-7');
    expect(getAstrologyKnowledge('jyeshtha', 'vedic')?.featureId).toBe('vedic-nakshatra-jyeshtha');
    expect(getAstrologyKnowledge('saturn mahadasha', 'vedic')?.featureId).toBe('vedic-dasha-saturn');
  });

  it('returns undefined (honest not-found signal) for an unrecognized topic, never a fabricated entry', () => {
    expect(getAstrologyKnowledge('xyzzy not a real topic', 'vedic')).toBeUndefined();
    expect(getAstrologyKnowledge('xyzzy not a real topic', 'western')).toBeUndefined();
    expect(getAstrologyKnowledge('', 'vedic')).toBeUndefined();
  });

  it('no entry claims a guaranteed/certain outcome in its limitations field', () => {
    for (const entry of getAllAstrologyKnowledgeEntries()) {
      expect(entry.limitations.toLowerCase()).not.toMatch(/guaranteed to|will definitely/);
    }
  });
});
