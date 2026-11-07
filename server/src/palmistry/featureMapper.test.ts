import { describe, expect, it } from 'vitest';
import { mapRawDetectionToObservations } from './featureMapper';
import { RawDetectionResult } from './visionDetector';

/** Minimal valid RawDetectionResult, with every confidence at 0/low, used as
 * a base so each test only has to override the one signal it cares about. */
function baseRaw(): RawDetectionResult {
  return {
    hand: 'right',
    handShapeLabel: 'uncertain',
    handShapeConfidence: 0,
    majorLines: {
      heart: { present: false, confidence: 0 },
      head: { present: false, confidence: 0 },
      life: { present: false, confidence: 0 },
      fate: { present: false, confidence: 0 },
    },
    mounts: {},
    fingers: {
      index: { lengthLabel: 'average', confidence: 0 },
      middle: { lengthLabel: 'average', confidence: 0 },
      ring: { lengthLabel: 'average', confidence: 0 },
      little: { lengthLabel: 'average', confidence: 0 },
    },
    thumb: { flexibilityLabel: 'unclear', flexibilityConfidence: 0, sizeLabel: 'average', sizeConfidence: 0 },
    nails: { shapeLabel: 'unclear', confidence: 0 },
    markings: [],
    isHandDetected: true,
    isPalmVisible: true,
    handSide: 'right',
    handSideConfidence: 0.8,
    multipleHandsDetected: false,
    isFullyFramed: true,
    validationStatus: 'accepted',
    rejectionReason: null,
  };
}

describe('mapRawDetectionToObservations - confidence-threshold gating', () => {
  it('does NOT match a major line whose confidence is below DEFAULT_CONFIDENCE_THRESHOLD (0.6)', () => {
    const raw = baseRaw();
    raw.majorLines.heart = { present: true, confidence: 0.5, lengthLabel: 'long', depthLabel: 'medium', shapeLabel: 'curved', variantHints: [] };
    const mapped = mapRawDetectionToObservations(raw);
    const heart = mapped.majorLines.find((l) => l.line === 'heart')!;
    expect(heart.matchedFeatureIds).toEqual([]);
    expect(heart.detected).toBe(false);
  });

  it('routes a below-threshold-but-above-the-absolute-floor line into uncertainFeatures rather than a confirmed section', () => {
    const raw = baseRaw();
    raw.majorLines.heart = { present: true, confidence: 0.5, lengthLabel: 'long', depthLabel: 'medium', shapeLabel: 'curved', variantHints: [] };
    const mapped = mapRawDetectionToObservations(raw);
    expect(mapped.uncertainFeatures.some((note) => note.includes('heart'))).toBe(true);
  });

  it('DOES match a major line whose confidence clears the 0.6 threshold', () => {
    const raw = baseRaw();
    raw.majorLines.heart = { present: true, confidence: 0.75, lengthLabel: 'long', depthLabel: 'medium', shapeLabel: 'curved', variantHints: [] };
    const mapped = mapRawDetectionToObservations(raw);
    const heart = mapped.majorLines.find((l) => l.line === 'heart')!;
    expect(heart.matchedFeatureIds.length).toBeGreaterThan(0);
    expect(heart.detected).toBe(true);
  });

  it('never matches anything below the absolute floor (0.2), regardless of label', () => {
    const raw = baseRaw();
    raw.majorLines.life = { present: true, confidence: 0.15, lengthLabel: 'long', depthLabel: 'deep', shapeLabel: 'wide-arc', variantHints: [] };
    const mapped = mapRawDetectionToObservations(raw);
    const life = mapped.majorLines.find((l) => l.line === 'life')!;
    expect(life.matchedFeatureIds).toEqual([]);
  });
});
