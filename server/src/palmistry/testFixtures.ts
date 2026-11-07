import sharp from 'sharp';
import { AiProvider, ChatMessage } from '../ai/types';
import { PalmAnalysisResult } from '../types/palm';

/**
 * Generates a REAL, genuinely decodable PNG image buffer via sharp, filled
 * with random noise at mid-brightness. This is a real image (sharp's own
 * quality checks - sharpness/brightness/contrast - run against genuine
 * pixel data, not a stub), used so tests can exercise the quality-gating
 * path honestly. It has no actual hand content, so it is NOT a substitute
 * for testing hand/palm content detection, which requires either a real
 * photograph or a mocked vision-detector response (see
 * fakeRawDetectionRejectedNoHand/AcceptedPartial above).
 */
export async function generateNoiseTestImage(width = 800, height = 800): Promise<Buffer> {
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = Math.floor(Math.random() * 200) + 30; // 30-230, avoids extremes
  }
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

/** A real, decodable but deliberately solid-color (very low edge-variance,
 * so genuinely blurry-by-the-metric) PNG, for testing the quality-rejection
 * path with a real sharp-computed measurement rather than a mock. */
export async function generateFlatTestImage(width = 800, height = 800): Promise<Buffer> {
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels, 128);
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

/** Call-counting fake AiProvider for tests, same pattern as other
 * test files in this repo that fake AiProvider (see assistant tests). */
export class CountingFakeAiProvider implements AiProvider {
  callCount = 0;
  async complete(_messages: ChatMessage[]): Promise<string> {
    this.callCount += 1;
    return 'fake AI narrative';
  }
}

/** A deterministic fixture with several confidently-matched features, used
 * across palmistry tests so they don't depend on a live vision call. */
export function fixtureAnalysisWithMatches(): PalmAnalysisResult {
  return {
    analysisId: 'test-analysis-1',
    analyzerVersion: 'test-fixture',
    detectionMethod: 'vision-model-assisted-structured',
    hand: 'right',
    validation: { status: 'accepted', reason: null, isHandDetected: true, isPalmVisible: true, handSide: 'right', handSideConfidence: 0.8, multipleHandsDetected: false, isFullyFramed: true },
    imageQuality: { ok: true, issues: [], sharpnessScore: 0.8, brightnessScore: 0.6, contrastScore: 0.5, widthPx: 1000, heightPx: 1000 },
    handShape: { shape: 'earth', confidence: 0.7, confidenceLabel: 'medium', matchedFeatureIds: ['hand-shape-earth'] },
    majorLines: [
      { line: 'heart', detected: true, confidence: 0.75, confidenceLabel: 'medium', matchedFeatureIds: ['heart-line-curved', 'heart-line-deep'] },
      { line: 'head', detected: false, confidence: 0.3, confidenceLabel: 'low', matchedFeatureIds: [] },
      { line: 'life', detected: true, confidence: 0.65, confidenceLabel: 'medium', matchedFeatureIds: ['life-line-wide-arc'] },
      { line: 'fate', detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    ],
    minorLines: [],
    mounts: [
      { mount: 'jupiter', detected: true, confidence: 0.7, confidenceLabel: 'medium', matchedFeatureIds: ['mount-jupiter'] },
    ],
    fingers: [
      { finger: 'index', detected: true, confidence: 0.65, confidenceLabel: 'medium', matchedFeatureIds: ['finger-index-long'] },
    ],
    thumb: { detected: false, confidence: 0.2, confidenceLabel: 'low', matchedFeatureIds: [] },
    nails: { detected: false, confidence: 0.1, confidenceLabel: 'low', matchedFeatureIds: [] },
    specialMarkings: [],
    uncertainFeatures: ['head line: observed with confidence 0.30, below the threshold needed to report a specific variant.'],
  };
}

/** A fake raw detection result representing a clearly rejected image
 * (e.g. a face photo) - used to test routes/palm.ts's rejection path
 * without a real vision call. Mocked, not a genuine CV classification. */
export function fakeRawDetectionRejectedNoHand(): import('./visionDetector').RawDetectionResult {
  return {
    hand: 'unknown',
    handShapeLabel: 'uncertain',
    handShapeConfidence: 0,
    majorLines: {
      heart: { present: false, confidence: 0 }, head: { present: false, confidence: 0 },
      life: { present: false, confidence: 0 }, fate: { present: false, confidence: 0 },
    },
    mounts: {},
    fingers: {
      index: { lengthLabel: 'average', confidence: 0 }, middle: { lengthLabel: 'average', confidence: 0 },
      ring: { lengthLabel: 'average', confidence: 0 }, little: { lengthLabel: 'average', confidence: 0 },
    },
    thumb: { flexibilityLabel: 'unclear', flexibilityConfidence: 0, sizeLabel: 'average', sizeConfidence: 0 },
    nails: { shapeLabel: 'unclear', confidence: 0 },
    markings: [],
    isHandDetected: false,
    isPalmVisible: false,
    handSide: 'unknown',
    handSideConfidence: 0,
    multipleHandsDetected: false,
    isFullyFramed: false,
    validationStatus: 'rejected_no_hand',
    rejectionReason: "We couldn't detect a hand in this photo - please photograph your open palm.",
  };
}

/** Same shape, but representing an accepted-with-limited-visibility image
 * (e.g. palm visible but wrist cropped off). Mocked, not a genuine CV
 * classification. */
export function fakeRawDetectionAcceptedPartial(): import('./visionDetector').RawDetectionResult {
  return {
    hand: 'right',
    handShapeLabel: 'earth',
    handShapeConfidence: 0.6,
    majorLines: {
      heart: { present: true, confidence: 0.7, lengthLabel: 'medium', depthLabel: 'medium', shapeLabel: 'curved', variantHints: [] },
      head: { present: false, confidence: 0.2 }, life: { present: false, confidence: 0.2 }, fate: { present: false, confidence: 0 },
    },
    mounts: {},
    fingers: {
      index: { lengthLabel: 'average', confidence: 0.3 }, middle: { lengthLabel: 'average', confidence: 0.3 },
      ring: { lengthLabel: 'average', confidence: 0.3 }, little: { lengthLabel: 'average', confidence: 0.3 },
    },
    thumb: { flexibilityLabel: 'unclear', flexibilityConfidence: 0, sizeLabel: 'average', sizeConfidence: 0 },
    nails: { shapeLabel: 'unclear', confidence: 0 },
    markings: [],
    isHandDetected: true,
    isPalmVisible: true,
    handSide: 'right',
    handSideConfidence: 0.75,
    multipleHandsDetected: false,
    isFullyFramed: false,
    validationStatus: 'accepted_partial',
    rejectionReason: 'We can only see part of your palm - make sure the whole palm and wrist are in frame for the fullest reading.',
  };
}

export function fixtureAnalysisWithNoMatches(): PalmAnalysisResult {
  return {
    analysisId: 'test-analysis-empty',
    analyzerVersion: 'test-fixture',
    detectionMethod: 'unavailable',
    hand: 'unknown',
    validation: { status: 'accepted', reason: null, isHandDetected: true, isPalmVisible: true, handSide: 'unknown', handSideConfidence: 0, multipleHandsDetected: false, isFullyFramed: true },
    imageQuality: { ok: true, issues: [], sharpnessScore: 0.5, brightnessScore: 0.5, contrastScore: 0.5, widthPx: 800, heightPx: 800 },
    handShape: { shape: 'uncertain', confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    majorLines: [
      { line: 'heart', detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
      { line: 'head', detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
      { line: 'life', detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
      { line: 'fate', detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    ],
    minorLines: [],
    mounts: [],
    fingers: [],
    thumb: { detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    nails: { detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] },
    specialMarkings: [],
    uncertainFeatures: ['No vision-assisted detection pass could be run (no API key configured, or the call failed) - only image-quality gating was performed.'],
  };
}
