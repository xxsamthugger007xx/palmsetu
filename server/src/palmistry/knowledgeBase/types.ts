/**
 * The Answer Book schema: one typed entry per distinct palmistry feature
 * variation. This is pure content data, no CV dependency - see the top
 * level task notes for why this is the highest-value, most achievable part
 * of the whole palmistry backend.
 *
 * Every entry must carry non-empty required fields (enforced by
 * knowledgeBaseService.ts's validation pass) and must never claim lifespan,
 * death, illness, fertility/pregnancy, exact marriage count, or guaranteed
 * wealth/career outcomes - each entry's `limitations` field is the place
 * that enforcement is written down explicitly for that feature.
 */

export type KnowledgeCategory =
  | 'heartLine' | 'headLine' | 'lifeLine' | 'fateLine' | 'minorLine'
  | 'mount' | 'finger' | 'thumb' | 'nail' | 'handShape' | 'marking';

export interface KnowledgeEntry {
  featureId: string; // stable, unique id, e.g. 'heart-line-long-deep'
  category: KnowledgeCategory;
  featureName: string;
  location: string;
  visualDescription: string;
  detectionCriteria: string;
  confidenceThreshold: number; // 0-1, minimum confidence required before this id may be matched
  traditionalMeaning: string;
  personalityInterpretation: string;
  emotionalInterpretation: string;
  relationshipInterpretation: string;
  strengths: string[];
  challenges: string[];
  freeReading: string; // short, used verbatim in the free report
  premiumReading: string; // longer, used verbatim in the premium report
  relatedFeatures: string[]; // other featureIds this one often co-occurs with
  combinationRules: string[]; // ruleIds in combinationEngine.ts that reference this feature
  limitations: string; // explicit statement of what this feature does NOT mean / predict
  sourceReferences: string[];
  version: string;
}
