import { describe, expect, it } from 'vitest';
import { buildFreeReading } from './staticPalmistryEngine';
import { buildPremiumSectionsDeterministic, generatePremiumReport } from './premiumPalmistryEngine';
import { fixtureAnalysisWithMatches } from './testFixtures';
import { PalmAnalysisResult } from '../types/palm';

/** Builds a minimal, otherwise-empty analysis with exactly the given
 * major-line matches, so each test can isolate one specific feature-id
 * lookup without depending on the shared multi-feature fixture. */
function analysisWithLineMatches(overrides: {
  heart?: string[]; head?: string[]; life?: string[]; fate?: string[];
}): PalmAnalysisResult {
  return {
    analysisId: 'test-isolated',
    analyzerVersion: 'test-fixture',
    detectionMethod: 'vision-model-assisted-structured',
    hand: 'right',
    validation: { status: 'accepted', reason: null, isHandDetected: true, isPalmVisible: true, handSide: 'right', handSideConfidence: 0.8, multipleHandsDetected: false, isFullyFramed: true },
    imageQuality: { ok: true, issues: [], sharpnessScore: 0.8, brightnessScore: 0.6, contrastScore: 0.5, widthPx: 1000, heightPx: 1000 },
    handShape: { shape: 'uncertain', confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    majorLines: [
      { line: 'heart', detected: (overrides.heart?.length ?? 0) > 0, confidence: 0.75, confidenceLabel: 'medium', matchedFeatureIds: overrides.heart ?? [] },
      { line: 'head', detected: (overrides.head?.length ?? 0) > 0, confidence: 0.75, confidenceLabel: 'medium', matchedFeatureIds: overrides.head ?? [] },
      { line: 'life', detected: (overrides.life?.length ?? 0) > 0, confidence: 0.75, confidenceLabel: 'medium', matchedFeatureIds: overrides.life ?? [] },
      { line: 'fate', detected: (overrides.fate?.length ?? 0) > 0, confidence: 0.75, confidenceLabel: 'medium', matchedFeatureIds: overrides.fate ?? [] },
    ],
    minorLines: [],
    mounts: [],
    fingers: [],
    thumb: { detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    nails: { detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    specialMarkings: [],
    uncertainFeatures: [],
  };
}

describe('knowledge-base feature matching', () => {
  it('a long heart line retrieves the long-heart-line entry, not a generic or curved one', () => {
    const reading = buildFreeReading(analysisWithLineMatches({ heart: ['heart-line-long'] }));
    expect(reading.sections.length).toBe(1);
    expect(reading.sections[0].featureIds).toEqual(['heart-line-long']);
    expect(reading.sections[0].text).toContain('runs long across the palm');
  });

  it('a curved heart line retrieves a different, correct entry than the long-line one', () => {
    const reading = buildFreeReading(analysisWithLineMatches({ heart: ['heart-line-curved'] }));
    expect(reading.sections.length).toBe(1);
    expect(reading.sections[0].featureIds).toEqual(['heart-line-curved']);
    expect(reading.sections[0].text).toContain('curves upward');
  });

  it('a broken life line retrieves the life-line-break entry', () => {
    const reading = buildFreeReading(analysisWithLineMatches({ life: ['life-line-break'] }));
    expect(reading.sections.length).toBe(1);
    expect(reading.sections[0].text).toContain('break in your life line');
    expect(reading.sections[0].text).toContain('rather than illness or any medical event');
  });

  it('a downward-sloping head line retrieves the head-line-slopes-steeply entry', () => {
    const reading = buildFreeReading(analysisWithLineMatches({ head: ['head-line-slopes-steeply'] }));
    expect(reading.sections.length).toBe(1);
    expect(reading.sections[0].text).toContain('slopes toward the wrist');
  });

  it('a combination of qualifying features triggers the expected combination rule', () => {
    const reading = buildFreeReading(analysisWithLineMatches({ heart: ['heart-line-curved', 'heart-line-deep'] }));
    const combo = reading.combinedInterpretations.find((c) => c.ruleId === 'curved-deep-heart-line');
    expect(combo).toBeDefined();
  });

  it('an unrecognized feature signal does not produce a fabricated interpretation', () => {
    const reading = buildFreeReading(analysisWithLineMatches({ heart: ['heart-line-does-not-exist'] }));
    expect(reading.sections.length).toBe(0);
  });

  it('premium engine produces the same specific retrieval behavior as the free engine', () => {
    const { sections } = buildPremiumSectionsDeterministic(analysisWithLineMatches({ heart: ['heart-line-long'] }));
    expect(sections.length).toBe(1);
    expect(sections[0].featureIds).toEqual(['heart-line-long']);
  });

  it('determinism: calling generatePremiumReport twice with identical input yields byte-identical output', () => {
    const analysis = fixtureAnalysisWithMatches();
    const a = JSON.stringify(generatePremiumReport(analysis));
    const b = JSON.stringify(generatePremiumReport(analysis));
    expect(a).toBe(b);
  });
});
