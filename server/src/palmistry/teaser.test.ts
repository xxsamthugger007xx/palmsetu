import { describe, it, expect } from 'vitest';
import { teaserText, redactLockedSections } from './teaser';

const LONG = 'Your heart line curves gently upward toward the index finger, which traditional palmists read as a warm, open way of relating to people. It is often described alongside patience and loyalty in close relationships.';

describe('teaserText', () => {
  it('keeps only the opening of the first sentence, on a word boundary, without the rest', () => {
    const t = teaserText(LONG);
    expect(t.length).toBeLessThanOrEqual(70);
    expect(LONG.startsWith(t)).toBe(true);
    expect(t).not.toMatch(/loyalty/);
    expect(t).not.toMatch(/\s$/);
  });
  it('returns a short first sentence whole, without its final period', () => {
    expect(teaserText('A deep life line. More text follows here.')).toBe('A deep life line');
  });
  it('handles single-sentence and whitespace-heavy text', () => {
    expect(teaserText('  Short   observation  ')).toBe('Short observation');
    expect(teaserText('x'.repeat(200)).length).toBeLessThanOrEqual(70);
  });
});

describe('redactLockedSections', () => {
  const reading: any = {
    id: 'r1', premiumReport: null,
    freeReading: { summary: 's', sections: [
      { title: 'Heart', text: LONG, featureIds: [], sectionKey: 'heartLine' },
      { title: 'Head', text: LONG, featureIds: [], sectionKey: 'headLine' },
    ] },
  };
  it('truncates locked sections and leaves unlocked ones whole', () => {
    const out = redactLockedSections(reading, new Set(['headLine']));
    expect(out.freeReading.sections[0].text.length).toBeLessThanOrEqual(70);
    expect(out.freeReading.sections[0].textTruncated).toBe(true);
    expect(out.freeReading.sections[1].text).toBe(LONG);
    expect(out.freeReading.sections[0].text).not.toContain('loyalty'); // locked text is gone from the payload
    expect(reading.freeReading.sections[0].text).toBe(LONG); // original untouched
  });
  it('cuts the summary and combined patterns too, until every detected section is unlocked', () => {
    const r: any = { id: 'r2', premiumReport: null, freeReading: {
      summary: LONG, summaryTruncated: undefined,
      combinedInterpretations: [{ ruleId: 'a', title: 'T', text: LONG, involvedFeatureIds: [] }],
      sections: [
        { title: 'Heart', text: LONG, featureIds: [], sectionKey: 'heartLine' },
        { title: 'Head', text: LONG, featureIds: [], sectionKey: 'headLine' },
      ] } };
    const partial = redactLockedSections(r, new Set(['heartLine']));
    expect(partial.freeReading.summary.length).toBeLessThanOrEqual(70);
    expect(partial.freeReading.summaryTruncated).toBe(true);
    expect(partial.freeReading.combinedInterpretations[0].text.length).toBeLessThanOrEqual(70);
    expect(partial.freeReading.combinedInterpretations[0].textTruncated).toBe(true);
    const all = redactLockedSections(r, new Set(['heartLine', 'headLine']));
    expect(all.freeReading.summary).toBe(LONG);
    expect(all.freeReading.summaryTruncated).toBe(false);
    expect(all.freeReading.combinedInterpretations[0].text).toBe(LONG);
  });

  it('shows everything for a reading with a generated premium report', () => {
    const full = { ...reading, premiumReport: {} };
    expect(redactLockedSections(full, new Set()).freeReading.sections[0].text).toBe(LONG);
  });
});
