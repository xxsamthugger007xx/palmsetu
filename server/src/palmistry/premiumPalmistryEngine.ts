/**
 * 100% deterministic premium-reading generator.
 *
 * HARD ARCHITECTURAL RULE (same guarantee as staticPalmistryEngine.ts):
 * this file must never import AiProvider, the Gemini provider, or any AI
 * client, at the type or import level - not merely "doesn't happen to call
 * it at runtime." Grep this file yourself before changing it: if
 * `AiProvider` or any `ai/*` module ever appears in its import list, that
 * is a violation of the architecture. Palm reading interpretation - free
 * AND premium - must never require a Gemini API key. (Note: the earlier
 * version of this file did call an AiProvider for an optional narrative
 * rephrasing pass; that call has been removed entirely, not merely made
 * fallback-only, per explicit product direction. Feature DETECTION from
 * the photo still runs through visionDetector.ts, which is a separate,
 * still-AI-backed pipeline stage that this file has no involvement in and
 * does not change.)
 *
 * "Premium" here means deeper deterministic content, not AI-personalized
 * prose: every matched knowledge-base entry contributes its fuller
 * `premiumReading` text plus its personality/emotional/relationship
 * breakdown and strengths/challenges, and every satisfied combination rule
 * is included (not just the single top rule). Same content for the same
 * input, always - there is no model variance to account for.
 */
import { CombinedInterpretation, PalmAnalysisResult, PalmPremiumReport } from '../types/palm';
import { getKnowledgeEntry } from './knowledgeBase/knowledgeBaseService';
import { KnowledgeEntry } from './knowledgeBase/types';
import { evaluateCombinationRules } from './combinationEngine';
import { MatchedFeature } from '../types/palm';

const PREMIUM_SECTION_TITLES: Record<string, string> = {
  heartLine: 'Heart Line - In Depth', headLine: 'Head Line - In Depth', lifeLine: 'Life Line - In Depth',
  fateLine: 'Fate Line - In Depth', minorLine: 'Minor Lines', mount: 'Mounts - Elemental Strengths',
  finger: 'Fingers & Proportions', thumb: 'Thumb', nail: 'Nails', handShape: 'Hand Shape - Full Profile',
  marking: 'Special Markings',
};

function collectMatchedFeatures(analysis: PalmAnalysisResult): MatchedFeature[] {
  const out: MatchedFeature[] = [];
  const pools: { matchedFeatureIds: string[]; confidence: number }[] = [
    ...analysis.majorLines, ...analysis.minorLines, ...analysis.mounts,
    ...analysis.fingers, analysis.thumb, analysis.nails, ...analysis.specialMarkings,
    { matchedFeatureIds: analysis.handShape.matchedFeatureIds, confidence: analysis.handShape.confidence },
  ];
  for (const obs of pools) {
    for (const id of obs.matchedFeatureIds) out.push({ featureId: id, confidence: obs.confidence });
  }
  return out;
}

/** Builds one richer section per matched feature, going beyond the free
 * tier's single `freeReading` line: the fuller `premiumReading` paragraph,
 * followed by the personality/emotional/relationship breakdown and the
 * strengths/challenges lists already present in the knowledge-base schema
 * (knowledgeBase/types.ts), closing with the same `limitations` hedge the
 * free tier relies on - never weakened, never dropped. */
function buildFeatureSectionText(entry: KnowledgeEntry): string {
  const parts: string[] = [entry.premiumReading];
  parts.push(`Personality: ${entry.personalityInterpretation}`);
  parts.push(`Emotional life: ${entry.emotionalInterpretation}`);
  parts.push(`Relationships: ${entry.relationshipInterpretation}`);
  if (entry.strengths.length > 0) parts.push(`Strengths traditionally associated with this: ${entry.strengths.join(', ')}.`);
  if (entry.challenges.length > 0) parts.push(`Traditionally worth watching for: ${entry.challenges.join(', ')}.`);
  parts.push(`What this does not mean: ${entry.limitations}`);
  return parts.join('\n\n');
}

/** Builds the deterministic section content for the premium report. Pure
 * and side-effect free - calling this twice with the same analysis must
 * produce byte-identical output, since there is no AI step left to
 * introduce variance. */
export function buildPremiumSectionsDeterministic(analysis: PalmAnalysisResult): {
  sections: PalmPremiumReport['sections'];
  combined: CombinedInterpretation[];
} {
  const matched = collectMatchedFeatures(analysis);
  const combined = evaluateCombinationRules(matched);
  const sections: PalmPremiumReport['sections'] = [];
  for (const m of matched) {
    const entry = getKnowledgeEntry(m.featureId);
    if (!entry) continue; // never fabricate a section for an id the knowledge base doesn't actually have
    sections.push({
      title: `${PREMIUM_SECTION_TITLES[entry.category] ?? entry.category}: ${entry.featureName}`,
      text: buildFeatureSectionText(entry),
      featureIds: [entry.featureId],
    });
  }
  // Every satisfied combination rule is included here, not only the
  // highest-confidence one - this is part of what makes premium content
  // deeper than the free tier.
  for (const c of combined) {
    sections.push({ title: `Combination: ${c.title}`, text: c.text, featureIds: c.involvedFeatureIds });
  }
  return { sections, combined };
}

/**
 * Generates the full premium report. Entirely deterministic: given the
 * same analysis, always returns the same sections, in the same order, with
 * no narrative/AI pass. Callers MUST perform backend entitlement
 * verification (tier check, MAX_FREE quota, recordTransaction) in the
 * ROUTE before this module is ever invoked - this file does not re-check
 * entitlement itself, it trusts its caller, exactly the way the
 * gemstone/vastu premium routes already work. See routes/palm.ts's
 * premium-report endpoint for the gate.
 */
export function generatePremiumReport(analysis: PalmAnalysisResult): PalmPremiumReport {
  const { sections } = buildPremiumSectionsDeterministic(analysis);
  // `narrative`/`aiNarrativeUsed` are kept on the PalmPremiumReport shape
  // for backward storage compatibility with any previously-generated and
  // cached reports, but this generator never populates narrative anymore -
  // the sections above are the complete premium report on their own.
  return { sections, narrative: null, aiNarrativeUsed: false };
}
