/**
 * 100% deterministic free-reading generator.
 *
 * HARD ARCHITECTURAL RULE: this file must never import AiProvider, the
 * Gemini provider, or any AI client, at the type or import level - not
 * merely "doesn't happen to call it at runtime." Grep this file yourself
 * before changing it: if `AiProvider` or any `ai/*` module ever appears in
 * its import list, that is a violation of the free/paid separation this
 * feature depends on. Free users must never trigger an LLM call, and this
 * file is how that guarantee is enforced architecturally rather than by
 * convention.
 *
 * Every sentence in the output of this file is either a verbatim
 * `free_reading` string from the knowledge base, a combination-engine
 * output string, or static scaffolding text - never model-generated prose.
 */
import { CombinedInterpretation, MatchedFeature, PalmAnalysisResult, PalmFreeReading } from '../types/palm';
import { getKnowledgeEntry } from './knowledgeBase/knowledgeBaseService';
import { evaluateCombinationRules } from './combinationEngine';

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

const SECTION_TITLES: Record<string, string> = {
  heartLine: 'Heart Line', headLine: 'Head Line', lifeLine: 'Life Line', fateLine: 'Fate Line',
  minorLine: 'Minor Lines', mount: 'Mounts', finger: 'Fingers', thumb: 'Thumb', nail: 'Nails',
  handShape: 'Hand Shape', marking: 'Special Markings',
};

export function buildFreeReading(analysis: PalmAnalysisResult): PalmFreeReading {
  const matched = collectMatchedFeatures(analysis);
  const combined: CombinedInterpretation[] = evaluateCombinationRules(matched);

  const sections: PalmFreeReading['sections'] = [];
  for (const m of matched) {
    const entry = getKnowledgeEntry(m.featureId);
    if (!entry) continue; // never fabricate a section for an id the knowledge base doesn't actually have
    sections.push({ title: `${SECTION_TITLES[entry.category] ?? entry.category}: ${entry.featureName}`, text: entry.freeReading, featureIds: [entry.featureId] });
  }

  const detectedCount = sections.length;
  const summary = detectedCount > 0
    ? `This reading is grounded in ${detectedCount} feature${detectedCount === 1 ? '' : 's'} that were confidently observed in your photo, each matched against traditional palmistry interpretations - never invented, and never shown for anything that wasn't actually detected.`
    : 'No specific features could be confidently matched from this photo. This is a reflection of image clarity and detection confidence, not a judgment about your hand - try retaking the photo in brighter, even lighting with the full palm visible.';

  const reflectiveQuestions = detectedCount > 0
    ? [
        'Which of the traits named above feels most true to how you have been living lately?',
        'Is there one small action this week that would reflect the version of yourself you want to grow into?',
      ]
    : ['Even without a confident reading this time, what is one thing on your mind about your own growth right now?'];

  const limitedVisibility = analysis.validation.status === 'accepted_partial';
  const finalSummary = limitedVisibility
    ? `Limited visibility: only part of your palm was clearly in frame, so this reading covers fewer features than usual. ${summary}`
    : summary;

  return { summary: finalSummary, sections, combinedInterpretations: combined, reflectiveQuestions, limitedVisibility };
}
