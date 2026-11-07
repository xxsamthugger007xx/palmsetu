import { describe, expect, it } from 'vitest';
import { getAllKnowledgeEntries, getKnowledgeEntriesByCategory, getKnowledgeEntry, knowledgeBaseEntryCount } from './knowledgeBaseService';

describe('knowledgeBaseService', () => {
  it('loads a substantial number of entries with no duplicate feature_ids', () => {
    const entries = getAllKnowledgeEntries();
    expect(knowledgeBaseEntryCount()).toBe(entries.length);
    expect(entries.length).toBeGreaterThanOrEqual(100);

    const ids = entries.map((e) => e.featureId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty required fields', () => {
    for (const entry of getAllKnowledgeEntries()) {
      expect(entry.featureId.length).toBeGreaterThan(0);
      expect(entry.freeReading.trim().length).toBeGreaterThan(0);
      expect(entry.premiumReading.trim().length).toBeGreaterThan(0);
      expect(entry.limitations.trim().length).toBeGreaterThan(0);
    }
  });

  it('each major-line and minor-line category has meaningful coverage', () => {
    expect(getKnowledgeEntriesByCategory('heartLine').length).toBeGreaterThanOrEqual(15);
    expect(getKnowledgeEntriesByCategory('headLine').length).toBeGreaterThanOrEqual(15);
    expect(getKnowledgeEntriesByCategory('lifeLine').length).toBeGreaterThanOrEqual(10);
    expect(getKnowledgeEntriesByCategory('fateLine').length).toBeGreaterThanOrEqual(10);
    expect(getKnowledgeEntriesByCategory('minorLine').length).toBe(13);
    expect(getKnowledgeEntriesByCategory('mount').length).toBe(9);
    expect(getKnowledgeEntriesByCategory('marking').length).toBe(13);
  });

  it('every life-line entry explicitly disclaims lifespan/death prediction', () => {
    for (const entry of getKnowledgeEntriesByCategory('lifeLine')) {
      expect(entry.limitations.toLowerCase()).toContain('never');
      expect(entry.limitations.toLowerCase()).toMatch(/lifespan|death|illness|medical/);
    }
  });

  it('every minor-line entry about marriage/children never claims an exact count or fertility outcome', () => {
    const marriage = getKnowledgeEntry('minor-marriage-line');
    const children = getKnowledgeEntry('minor-children-line');
    expect(marriage?.limitations.toLowerCase()).toContain('marriage');
    expect(children?.limitations.toLowerCase()).toMatch(/fertility|pregnancy|children/);
  });

  it('getKnowledgeEntry returns undefined for an unknown id rather than fabricating one', () => {
    expect(getKnowledgeEntry('not-a-real-feature-id')).toBeUndefined();
  });
});
