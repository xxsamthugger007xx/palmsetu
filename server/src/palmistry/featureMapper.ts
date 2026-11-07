import {
  FingerObservation, FingerType, HandShapeObservation, MajorLineObservation, MajorLineType,
  MarkingObservation, MarkingType, MinorLineObservation, MountObservation, MountType,
  NailObservation, ThumbObservation, confidenceLabel,
} from '../types/palm';
import { RawDetectionResult } from './visionDetector';
import { getKnowledgeEntry } from './knowledgeBase/knowledgeBaseService';
import { ABSOLUTE_MINIMUM_CONFIDENCE, DEFAULT_CONFIDENCE_THRESHOLD } from './detectionConfig';

/** Returns the feature's own knowledge-base threshold if one exists, else
 * the shared default - never guesses a threshold looser than the KB entry
 * explicitly set for conservatively-detected features like islands/dots. */
function thresholdFor(featureId: string): number {
  return getKnowledgeEntry(featureId)?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
}

/** Only ever matches a feature id when confidence clears both the absolute
 * floor and that feature's own (possibly stricter) threshold. */
function matchIfAboveThreshold(featureId: string, confidence: number): string[] {
  if (confidence < ABSOLUTE_MINIMUM_CONFIDENCE) return [];
  if (confidence < thresholdFor(featureId)) return [];
  return [featureId];
}

function mapMajorLine(line: MajorLineType, raw: RawDetectionResult['majorLines'][MajorLineType] | undefined): MajorLineObservation {
  if (!raw || !raw.present || raw.confidence < ABSOLUTE_MINIMUM_CONFIDENCE) {
    return { line, detected: false, confidence: raw?.confidence ?? 0, confidenceLabel: 'low', matchedFeatureIds: [], notes: 'Not confidently detected in the submitted image.' };
  }

  const matched: string[] = [];
  const lengthId = `${line}-line-${raw.lengthLabel}`;
  matched.push(...matchIfAboveThreshold(lengthId, raw.confidence));
  if (raw.depthLabel === 'deep') matched.push(...matchIfAboveThreshold(`${line}-line-deep`, raw.confidence));
  if (raw.depthLabel === 'faint') matched.push(...matchIfAboveThreshold(`${line}-line-faint`, raw.confidence));
  if (line === 'heart' && raw.shapeLabel === 'straight') matched.push(...matchIfAboveThreshold('heart-line-straight', raw.confidence));
  if (line === 'heart' && raw.shapeLabel === 'curved') matched.push(...matchIfAboveThreshold('heart-line-curved', raw.confidence));
  if (line === 'head' && raw.shapeLabel === 'straight') matched.push(...matchIfAboveThreshold('head-line-straight', raw.confidence));
  if (line === 'head' && raw.shapeLabel === 'slopes-slightly') matched.push(...matchIfAboveThreshold('head-line-slopes-slightly', raw.confidence));
  if (line === 'head' && raw.shapeLabel === 'slopes-steeply') matched.push(...matchIfAboveThreshold('head-line-slopes-steeply', raw.confidence));
  if (line === 'life' && raw.shapeLabel === 'wide-arc') matched.push(...matchIfAboveThreshold('life-line-wide-arc', raw.confidence));
  if (line === 'life' && raw.shapeLabel === 'close-arc') matched.push(...matchIfAboveThreshold('life-line-close-to-thumb', raw.confidence));

  // Variant hints are free-text and inherently lower-confidence signals
  // (the vision model naming something like "fork" or "break" in prose is
  // weaker evidence than a direct structured field), so they are matched
  // at a reduced effective confidence rather than the line's own reported
  // confidence, and only when a plausible knowledge-base id exists for them.
  const hintConfidence = Math.max(0, raw.confidence - 0.15);
  for (const hint of raw.variantHints ?? []) {
    const candidateId = `${line}-line-${hint}`;
    matched.push(...matchIfAboveThreshold(candidateId, hintConfidence));
  }

  const uniqueMatched = [...new Set(matched)];
  return {
    line,
    detected: uniqueMatched.length > 0,
    confidence: raw.confidence,
    confidenceLabel: confidenceLabel(raw.confidence),
    matchedFeatureIds: uniqueMatched,
    notes: uniqueMatched.length === 0 ? 'Line may be present but no specific variant could be matched with confidence.' : undefined,
  };
}

const MOUNT_TYPES: MountType[] = ['venus', 'jupiter', 'saturn', 'apollo', 'mercury', 'moon', 'upperMars', 'lowerMars', 'plainOfMars'];
const MOUNT_FEATURE_ID: Record<MountType, string> = {
  venus: 'mount-venus', jupiter: 'mount-jupiter', saturn: 'mount-saturn', apollo: 'mount-apollo',
  mercury: 'mount-mercury', moon: 'mount-moon', upperMars: 'mount-upper-mars', lowerMars: 'mount-lower-mars',
  plainOfMars: 'mount-plain-of-mars',
};

function mapMount(mount: MountType, raw: RawDetectionResult['mounts'][string] | undefined): MountObservation {
  if (!raw || raw.developmentLabel === 'unclear' || raw.confidence < ABSOLUTE_MINIMUM_CONFIDENCE) {
    return { mount, detected: false, confidence: raw?.confidence ?? 0, confidenceLabel: 'low', matchedFeatureIds: [], notes: 'Development level unclear from the submitted image.' };
  }
  const featureId = MOUNT_FEATURE_ID[mount];
  const matched = matchIfAboveThreshold(featureId, raw.confidence);
  return {
    mount,
    detected: matched.length > 0,
    confidence: raw.confidence,
    confidenceLabel: confidenceLabel(raw.confidence),
    matchedFeatureIds: matched,
    notes: matched.length > 0 ? `Development: ${raw.developmentLabel}` : undefined,
  };
}

const FINGER_FEATURE_ID: Record<FingerType, { long: string; short: string }> = {
  index: { long: 'finger-index-long', short: 'finger-index-short' },
  middle: { long: 'finger-middle-long', short: '' },
  ring: { long: 'finger-ring-long', short: '' },
  little: { long: 'finger-little-long', short: '' },
};

function mapFinger(finger: FingerType, raw: RawDetectionResult['fingers'][FingerType] | undefined): FingerObservation {
  if (!raw || raw.lengthLabel === 'average' || raw.confidence < ABSOLUTE_MINIMUM_CONFIDENCE) {
    return { finger, detected: false, confidence: raw?.confidence ?? 0, confidenceLabel: 'low', matchedFeatureIds: [], notes: 'Proportions read as average, or unclear from the submitted image.' };
  }
  const ids = FINGER_FEATURE_ID[finger];
  const featureId = raw.lengthLabel === 'long' ? ids.long : ids.short;
  const matched = featureId ? matchIfAboveThreshold(featureId, raw.confidence) : [];
  return {
    finger,
    detected: matched.length > 0,
    confidence: raw.confidence,
    confidenceLabel: confidenceLabel(raw.confidence),
    matchedFeatureIds: matched,
  };
}

function mapThumb(raw: RawDetectionResult['thumb'] | undefined): ThumbObservation {
  if (!raw) return { detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [] };
  const matched: string[] = [];
  if (raw.flexibilityLabel === 'flexible') matched.push(...matchIfAboveThreshold('thumb-flexible', raw.flexibilityConfidence));
  if (raw.flexibilityLabel === 'stiff') matched.push(...matchIfAboveThreshold('thumb-stiff', raw.flexibilityConfidence));
  if (raw.sizeLabel === 'large') matched.push(...matchIfAboveThreshold('thumb-large-proportional', raw.sizeConfidence));
  if (raw.sizeLabel === 'small') matched.push(...matchIfAboveThreshold('thumb-small-proportional', raw.sizeConfidence));
  const confidence = Math.max(raw.flexibilityConfidence ?? 0, raw.sizeConfidence ?? 0);
  return { detected: matched.length > 0, confidence, confidenceLabel: confidenceLabel(confidence), matchedFeatureIds: [...new Set(matched)] };
}

function mapNails(raw: RawDetectionResult['nails'] | undefined): NailObservation {
  if (!raw || raw.shapeLabel === 'unclear' || raw.confidence < ABSOLUTE_MINIMUM_CONFIDENCE) {
    return { detected: false, confidence: raw?.confidence ?? 0, confidenceLabel: 'low', matchedFeatureIds: [] };
  }
  const matched = matchIfAboveThreshold('nail-shape-length-width', raw.confidence);
  return { detected: matched.length > 0, confidence: raw.confidence, confidenceLabel: confidenceLabel(raw.confidence), matchedFeatureIds: matched, notes: `Shape: ${raw.shapeLabel}` };
}

const VALID_MARKING_TYPES: MarkingType[] = ['star', 'cross', 'triangle', 'square', 'circle', 'island', 'grille', 'trident', 'fish', 'branch', 'parallelLines', 'chain', 'dot'];
const MARKING_FEATURE_ID: Record<MarkingType, string> = {
  star: 'marking-star', cross: 'marking-cross', triangle: 'marking-triangle', square: 'marking-square',
  circle: 'marking-circle', island: 'marking-island', grille: 'marking-grille', trident: 'marking-trident',
  fish: 'marking-fish', branch: 'marking-branch', parallelLines: 'marking-parallel-lines', chain: 'marking-chain', dot: 'marking-dot',
};

function mapMarkings(raw: RawDetectionResult['markings'] | undefined): MarkingObservation[] {
  if (!raw) return [];
  const out: MarkingObservation[] = [];
  for (const m of raw) {
    if (!VALID_MARKING_TYPES.includes(m.type as MarkingType)) continue;
    const type = m.type as MarkingType;
    const featureId = MARKING_FEATURE_ID[type];
    const matched = matchIfAboveThreshold(featureId, m.confidence);
    if (matched.length === 0) continue; // markings below threshold are not surfaced at all, only noted in uncertainFeatures by the caller
    out.push({ marking: type, location: m.location, detected: true, confidence: m.confidence, confidenceLabel: confidenceLabel(m.confidence), matchedFeatureIds: matched });
  }
  return out;
}

function mapHandShape(raw: RawDetectionResult | null): HandShapeObservation {
  if (!raw || raw.handShapeConfidence < ABSOLUTE_MINIMUM_CONFIDENCE) {
    return { shape: 'uncertain', confidence: raw?.handShapeConfidence ?? 0, confidenceLabel: 'low', matchedFeatureIds: [] };
  }
  const featureId = `hand-shape-${raw.handShapeLabel}`;
  const matched = matchIfAboveThreshold(featureId, raw.handShapeConfidence);
  return {
    shape: matched.length > 0 ? raw.handShapeLabel : 'uncertain',
    confidence: raw.handShapeConfidence,
    confidenceLabel: confidenceLabel(raw.handShapeConfidence),
    matchedFeatureIds: matched,
  };
}

export interface MappedObservations {
  hand: 'left' | 'right' | 'unknown';
  handShape: HandShapeObservation;
  majorLines: MajorLineObservation[];
  minorLines: MinorLineObservation[];
  mounts: MountObservation[];
  fingers: FingerObservation[];
  thumb: ThumbObservation;
  nails: NailObservation;
  specialMarkings: MarkingObservation[];
  uncertainFeatures: string[];
}

/** Converts a raw vision-detection result (or null, if no vision call was
 * possible) into the app's typed, confidence-gated observation shapes.
 * Minor lines are not covered by the current vision prompt (see README/
 * memory follow-up notes) and are always reported as undetected - this is
 * an honest scoping limit, not a bug. */
export function mapRawDetectionToObservations(raw: RawDetectionResult | null): MappedObservations {
  const uncertain: string[] = [];
  const majorLines = (['heart', 'head', 'life', 'fate'] as MajorLineType[]).map((line) => {
    const obs = mapMajorLine(line, raw?.majorLines?.[line]);
    if (!obs.detected && (obs.confidence ?? 0) > 0) uncertain.push(`${line} line: observed with confidence ${obs.confidence.toFixed(2)}, below the threshold needed to report a specific variant.`);
    return obs;
  });

  const minorLines: MinorLineObservation[] = [
    'sun', 'mercury', 'marriage', 'children', 'travel', 'intuition', 'girdleOfVenus',
    'ringOfSolomon', 'ringOfSaturn', 'viaLascivia', 'marsLine', 'bracelets', 'sisterLine',
  ].map((line) => ({ line: line as MinorLineObservation['line'], detected: false, confidence: 0, confidenceLabel: 'low', matchedFeatureIds: [], notes: 'Minor-line detection is not yet covered by the current vision-detection pass - this is an honest scoping limit, not a negative finding.' }));

  const mounts = MOUNT_TYPES.map((m) => mapMount(m, raw?.mounts?.[m]));
  const fingers = (['index', 'middle', 'ring', 'little'] as FingerType[]).map((f) => mapFinger(f, raw?.fingers?.[f]));
  const thumb = mapThumb(raw?.thumb);
  const nails = mapNails(raw?.nails);
  const specialMarkings = mapMarkings(raw?.markings);
  const handShape = mapHandShape(raw);

  if (!raw) uncertain.push('No vision-assisted detection pass could be run (no API key configured, or the call failed) - only image-quality gating was performed.');

  return { hand: raw?.hand ?? 'unknown', handShape, majorLines, minorLines, mounts, fingers, thumb, nails, specialMarkings, uncertainFeatures: uncertain };
}
