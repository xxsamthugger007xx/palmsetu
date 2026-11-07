export type GemstonePlanet = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu';

export interface GemstoneDefinition {
  planet: GemstonePlanet;
  nameEnglish: string;
  nameHindi: string;
  alternativeName: string;
  alternativeIsEquivalent: false;
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
  reasonUnavailable?: string;
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
  calculationReference: string;
  dataCompleteness: DataCompleteness;
  goal: string | null;
  budget: string | null;
  primary: GemstoneRecommendation;
  alternative: GemstoneRecommendation;
  caratGuidance: CaratGuidance;
  explanation: string;
  explanationSource: 'ai' | 'static-fallback';
  saved: boolean;
}
