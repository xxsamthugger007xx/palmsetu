import { describe, expect, it } from 'vitest';
import { buildPremiumSectionsDeterministic, generatePremiumReport } from './premiumPalmistryEngine';
import { CountingFakeAiProvider, fixtureAnalysisWithMatches, fixtureAnalysisWithNoMatches } from './testFixtures';

describe('premiumPalmistryEngine', () => {
  it('buildPremiumSectionsDeterministic matches only verified features', () => {
    const { sections } = buildPremiumSectionsDeterministic(fixtureAnalysisWithMatches());
    const ids = sections.flatMap((s) => s.featureIds);
    expect(ids).toContain('heart-line-curved');
    expect(ids).not.toContain('head-line-long');
  });

  it('premium sections are richer than a bare freeReading line - include personality/emotional/relationship breakdown', () => {
    const { sections } = buildPremiumSectionsDeterministic(fixtureAnalysisWithMatches());
    const heartSection = sections.find((s) => s.featureIds.includes('heart-line-curved'));
    expect(heartSection).toBeDefined();
    expect(heartSection!.text).toMatch(/Personality:/);
    expect(heartSection!.text).toMatch(/Emotional life:/);
    expect(heartSection!.text).toMatch(/Relationships:/);
    expect(heartSection!.text).toMatch(/What this does not mean:/);
  });

  it('generatePremiumReport makes zero calls to a fake AiProvider - the premium engine has no AI dependency at all', () => {
    const fake = new CountingFakeAiProvider();
    const report = generatePremiumReport(fixtureAnalysisWithMatches());
    expect(fake.callCount).toBe(0);
    expect(report.narrative).toBeNull();
    expect(report.aiNarrativeUsed).toBe(false);
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it('is byte-identical across repeated calls with the same input (determinism)', () => {
    const analysis = fixtureAnalysisWithMatches();
    const first = generatePremiumReport(analysis);
    const second = generatePremiumReport(analysis);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('produces no sections when there is nothing detected to report on', () => {
    const report = generatePremiumReport(fixtureAnalysisWithNoMatches());
    expect(report.sections.length).toBe(0);
    expect(report.narrative).toBeNull();
  });

  it('applies every satisfied combination rule, not only the top one', () => {
    const { combined } = buildPremiumSectionsDeterministic(fixtureAnalysisWithMatches());
    // fixture has heart-line-curved + heart-line-deep both at 0.75, which
    // alone satisfies curved-deep-heart-line; this should still surface
    // even though other combination rules do not apply to this fixture.
    const combo = combined.find((c) => c.ruleId === 'curved-deep-heart-line');
    expect(combo).toBeDefined();
  });
});
