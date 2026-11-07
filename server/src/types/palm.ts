/**
 * Palmistry domain types.
 *
 * Detection model: every observation below carries a numeric `confidence`
 * (0-1) in addition to `detected`. Nothing is ever surfaced as detected:true
 * unless its confidence cleared the configured threshold (see
 * palmistry/detectionConfig.ts). `matchedFeatureIds` links an observation to
 * zero or more knowledge-base feature_ids it was matched against - the
 * interpretation layer only ever speaks about ids that appear here, never
 * about anything invented on the fly.
 */

export type Confidence = 'low' | 'medium' | 'high';

export function confidenceLabel(score: number): Confidence {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export type MajorLineType = 'heart' | 'head' | 'life' | 'fate';
export type MinorLineType =
  | 'sun' | 'mercury' | 'marriage' | 'children' | 'travel' | 'intuition'
  | 'girdleOfVenus' | 'ringOfSolomon' | 'ringOfSaturn' | 'viaLascivia'
  | 'marsLine' | 'bracelets' | 'sisterLine';
export type MountType =
  | 'venus' | 'jupiter' | 'saturn' | 'apollo' | 'mercury' | 'moon'
  | 'upperMars' | 'lowerMars' | 'plainOfMars';
export type FingerType = 'index' | 'middle' | 'ring' | 'little';
export type HandShapeType = 'earth' | 'air' | 'fire' | 'water' | 'mixed' | 'uncertain';
export type MarkingType =
  | 'star' | 'cross' | 'triangle' | 'square' | 'circle' | 'island'
  | 'grille' | 'trident' | 'fish' | 'branch' | 'parallelLines' | 'chain' | 'dot';

/** Base shape shared by every detected/undetected feature observation. */
export interface FeatureObservation {
  detected: boolean;
  confidence: number; // 0-1, real number, never fabricated to pad completeness
  confidenceLabel: Confidence;
  matchedFeatureIds: string[]; // knowledge-base feature_id values, empty if undetected
  notes?: string;
}

export interface MajorLineObservation extends FeatureObservation {
  line: MajorLineType;
}

export interface MinorLineObservation extends FeatureObservation {
  line: MinorLineType;
}

export interface MountObservation extends FeatureObservation {
  mount: MountType;
}

export interface FingerObservation extends FeatureObservation {
  finger: FingerType;
}

export interface ThumbObservation extends FeatureObservation {}

export interface NailObservation extends FeatureObservation {}

export interface MarkingObservation extends FeatureObservation {
  marking: MarkingType;
  location: string; // free-text coarse location, e.g. "near heart line, under Saturn mount"
}

export interface HandShapeObservation {
  shape: HandShapeType;
  confidence: number;
  confidenceLabel: Confidence;
  matchedFeatureIds: string[];
  notes?: string;
}

export interface ImageQualityReport {
  ok: boolean;
  issues: string[];
  sharpnessScore: number; // 0-1, derived from real pixel analysis (sharp), not byte size
  brightnessScore: number; // 0-1
  contrastScore: number; // 0-1
  widthPx: number;
  heightPx: number;
}

/**
 * Detection method label, carried on every analysis result so nothing
 * downstream can mistake this for classical CV landmark/crease segmentation.
 * 'vision-model-assisted-structured' means: a vision-capable Gemini call was
 * asked for coarse qualitative characteristics with per-field confidence,
 * not precise pixel-level geometry. 'unavailable' means no vision call could
 * be made (no API key, or the call failed) and only image-quality gating ran.
 */
export type DetectionMethod = 'vision-model-assisted-structured' | 'unavailable';

/** Content-based validation outcome, independent of (but combined with)
 * ImageQualityReport's pixel-level checks. See palmistry/visionDetector.ts
 * for how this is produced and palmistry/validation.ts for how it is
 * combined with image quality into a single gating decision. */
export type ValidationStatus =
  | 'accepted'
  | 'accepted_partial'
  | 'rejected_no_hand'
  | 'rejected_back_of_hand'
  | 'rejected_not_a_body_part'
  | 'rejected_multiple_hands'
  | 'rejected_quality';

export interface ImageValidation {
  status: ValidationStatus;
  reason: string | null;
  isHandDetected: boolean;
  isPalmVisible: boolean;
  handSide: 'left' | 'right' | 'unknown';
  /** Honest 0-1 confidence in handSide, straight from the vision model (see
   * palmistry/visionDetector.ts). Used client-side to decide whether a
   * disagreement with the user's own manual left/right selection is worth
   * surfacing as a warning - a low-confidence handSide should never trigger
   * one, since there is nothing reliable to compare against. */
  handSideConfidence: number;
  multipleHandsDetected: boolean;
  isFullyFramed: boolean;
}

export interface PalmAnalysisResult {
  analysisId: string;
  analyzerVersion: string;
  detectionMethod: DetectionMethod;
  hand: 'left' | 'right' | 'unknown';
  validation: ImageValidation;
  imageQuality: ImageQualityReport;
  handShape: HandShapeObservation;
  majorLines: MajorLineObservation[];
  minorLines: MinorLineObservation[];
  mounts: MountObservation[];
  fingers: FingerObservation[];
  thumb: ThumbObservation;
  nails: NailObservation;
  specialMarkings: MarkingObservation[];
  uncertainFeatures: string[]; // human-readable notes on anything below threshold
}

/** A matched knowledge-base entry plus the observation that triggered it,
 * used by the report generators. */
export interface MatchedFeature {
  featureId: string;
  confidence: number;
}

export interface CombinedInterpretation {
  ruleId: string;
  title: string;
  text: string;
  involvedFeatureIds: string[];
}

export interface PalmFreeReading {
  summary: string;
  sections: { title: string; text: string; featureIds: string[] }[];
  combinedInterpretations: CombinedInterpretation[];
  reflectiveQuestions: string[];
  /** True when the underlying analysis came from an accepted_partial image
   * (cropped palm, missing wrist, obscured lines, etc) - the frontend must
   * visibly show limited-visibility framing in this case, never present it
   * as an equally complete reading. */
  limitedVisibility: boolean;
}

export interface PalmPremiumReport {
  sections: { title: string; text: string; featureIds: string[] }[];
  narrative: string | null; // optional AI rephrasing pass, null if not generated
  aiNarrativeUsed: boolean;
}

export interface PalmReading {
  id: string;
  userId: string;
  createdAt: string;
  analysis: PalmAnalysisResult;
  freeReading: PalmFreeReading;
  premiumReportAvailable: boolean;
  premiumReport: PalmPremiumReport | null;
  premiumReportGeneratedAt: string | null;
}

export interface DailyPalmGuidance {
  userId: string;
  localDate: string;
  readingId: string;
  createdAt: string;
  dailyTheme: string;
  career: string;
  relationship: string;
  personalDevelopment: string;
  money: string;
  positiveAction: string;
  avoid: string;
  reflectiveQuestion: string;
  smallTask: string;
  luckyColor: string | null; // explicitly entertainment-framed, never predictive
}
