/**
 * Palmistry domain types - mirrors server/src/types/palm.ts exactly. Keep
 * these two files in sync; this file is the frontend's only source of
 * truth for the shape of a palm reading returned by the backend.
 */

export type Confidence = 'low' | 'medium' | 'high';

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

export interface FeatureObservation {
  detected: boolean;
  confidence: number;
  confidenceLabel: Confidence;
  matchedFeatureIds: string[];
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
  location: string;
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
  sharpnessScore: number;
  brightnessScore: number;
  contrastScore: number;
  widthPx: number;
  heightPx: number;
}

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
  handSideConfidence: number;
  multipleHandsDetected: boolean;
  isFullyFramed: boolean;
}

export type DetectionMethod = 'vision-model-assisted-structured' | 'unavailable';

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
  uncertainFeatures: string[];
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
  limitedVisibility: boolean;
}

export interface PalmPremiumReport {
  sections: { title: string; text: string; featureIds: string[] }[];
  narrative: string | null;
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
  luckyColor: string | null;
}

/** A structured rejection carried on a 422 response from POST /palm/readings. */
export interface PalmRejection {
  error: string;
  code: 'IMAGE_REJECTED';
  validationStatus: ValidationStatus;
  imageQuality: ImageQualityReport;
}
