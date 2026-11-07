import { describe, expect, it } from 'vitest';
import { buildFreeReading } from './staticPalmistryEngine';
import { fixtureAnalysisWithMatches, fixtureAnalysisWithNoMatches } from './testFixtures';

describe('buildFreeReading (static engine)', () => {
  it('only produces sections for features that were actually matched/detected', () => {
    const reading = buildFreeReading(fixtureAnalysisWithMatches());
    const ids = reading.sections.flatMap((s) => s.featureIds);
    // head and fate lines were undetected in the fixture - they must never appear.
    expect(ids).not.toContain('head-line-long');
    expect(ids).not.toContain('fate-line-absent');
    expect(ids).toContain('heart-line-curved');
    expect(ids).toContain('life-line-wide-arc');
  });

  it('free reading text traces back to real knowledge-base content, not arbitrary text', () => {
    const reading = buildFreeReading(fixtureAnalysisWithMatches());
    const heartSection = reading.sections.find((s) => s.featureIds.includes('heart-line-curved'));
    expect(heartSection).toBeDefined();
    expect(heartSection!.text).toContain('curves upward');
  });

  it('an undetected/low-confidence feature never appears as a confirmed section', () => {
    const reading = buildFreeReading(fixtureAnalysisWithNoMatches());
    expect(reading.sections.length).toBe(0);
    expect(reading.summary).not.toMatch(/heart line|head line|life line|fate line/i);
  });

  it('includes combination-engine output when the required features are both present', () => {
    const reading = buildFreeReading(fixtureAnalysisWithMatches());
    const combo = reading.combinedInterpretations.find((c) => c.ruleId === 'curved-deep-heart-line');
    expect(combo).toBeDefined();
  });
});
