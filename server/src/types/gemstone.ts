export type GemstonePlanet = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

export interface GemstoneDefinition {
  planet: GemstonePlanet;
  nameEnglish: string;
  nameHindi: string;
  alternativeName: string;
  alternativeIsEquivalent: false; // always false - alternatives are never presented as astrologically identical
  traditionalDay: string;
  traditionalFinger: string;
  traditionalMetal: string;
  customaryPractice: string;
}

export type RecommendationStrength = 'primary' | 'alternative' | 'none';

export interface GemstoneRecommendation {
  strength: RecommendationStrength;
  gemstone: GemstoneDefinition | null;
  ruleId: string;
  ruleExplanation: string;
  reasonUnavailable?: string; // populated when strength === 'none'
}

export interface CaratGuidance {
  available: boolean;
  suggestedRangeCarats: [number, number] | null;
  method: string;
  disclaimer: string;
  unavailableReason?: string;
}

export type DataCompleteness = 'full' | 'partial';

export interface GemstoneReport {
  id: string;
  userId: string;
  createdAt: string;
  datasetVersion: string;
  ruleEngineVersion: string;
  calculationReference: string; // engine version + method used
  dataCompleteness: DataCompleteness;
  goal: string | null;
  budget: string | null;
  primary: GemstoneRecommendation;
  alternative: GemstoneRecommendation;
  caratGuidance: CaratGuidance;
  explanation: string; // AI-personalized or static fallback
  explanationSource: 'ai' | 'static-fallback';
  saved: boolean;
}
