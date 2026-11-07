import { AiProvider } from '../ai/types';
import { GEMSTONE_SYSTEM_PROMPT } from '../ai/gemstoneSystemPrompt';
import { BirthProfile } from '../types/astrology';
import { GemstoneRecommendation } from '../types/gemstone';
import {
  recommendPrimaryGemstone, recommendAlternativeGemstone, buildCaratGuidance, RULE_ENGINE_VERSION,
} from './recommendationEngine';
import { ENGINE_VERSION } from '../astrology/engine';

const DATASET_VERSION = 'solune-gemstone-1.0';

function buildStaticExplanation(primary: GemstoneRecommendation, goal: string | null): string {
  if (primary.strength !== 'primary' || !primary.gemstone) {
    return primary.reasonUnavailable ?? 'No recommendation could be determined from the available chart data.';
  }
  const goalLine = goal ? ` As you're focused on ${goal.toLowerCase()}, this traditional guidance is offered alongside that intention, not as a guarantee tied to it.` : '';
  return `${primary.ruleExplanation}${goalLine}`;
}

/** Rejects obvious non-answers: angle-bracket placeholders, or our own prompt
 * instructions echoed back verbatim (e.g. by a naive mock provider that just
 * restates what it was sent - which would otherwise trivially "mention the
 * gemstone name" since the prompt itself contains it). */
function looksLikeRealAnswer(text: string): boolean {
  if (text.trim().length < 8) return false;
  if (text.includes('<') || text.includes('>')) return false;
  if (text.includes('Write a warm')) return false; // our own instruction text
  if (text.includes('[mock reply]')) return false;
  return true;
}

async function generateExplanation(
  primary: GemstoneRecommendation,
  goal: string | null,
  aiProvider: AiProvider
): Promise<{ text: string; source: 'ai' | 'static-fallback' }> {
  const staticText = buildStaticExplanation(primary, goal);
  if (primary.strength !== 'primary') return { text: staticText, source: 'static-fallback' };

  try {
    const prompt =
      `Recommended gemstone: ${primary.gemstone!.nameEnglish} (${primary.gemstone!.nameHindi}), ` +
      `associated with ${primary.gemstone!.planet}.\n` +
      `Rule explanation: ${primary.ruleExplanation}\n` +
      (goal ? `User's stated goal: ${goal}\n` : '') +
      `Write a warm, 3-4 sentence personalized explanation of this recommendation. Do not mention any other ` +
      `gemstone. Do not promise any outcome.`;

    const raw = await aiProvider.complete([
      { role: 'system', content: GEMSTONE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    if (looksLikeRealAnswer(raw) && raw.toLowerCase().includes(primary.gemstone!.nameEnglish.toLowerCase())) {
      return { text: raw.trim(), source: 'ai' };
    }
  } catch (err) {
    console.warn('[gemstone] AI explanation failed, using static fallback:', err);
  }

  return { text: staticText, source: 'static-fallback' };
}

export async function buildGemstoneReportContent(
  profile: BirthProfile,
  goal: string | null,
  aiProvider: AiProvider
) {
  const primary = recommendPrimaryGemstone(profile.natal);
  const alternative = recommendAlternativeGemstone(primary);
  const caratGuidance = buildCaratGuidance();
  const { text: explanation, source: explanationSource } = await generateExplanation(primary, goal, aiProvider);

  return {
    datasetVersion: DATASET_VERSION,
    ruleEngineVersion: RULE_ENGINE_VERSION,
    calculationReference: `${ENGINE_VERSION} / rashi-lord-v1`,
    dataCompleteness: profile.natal.birthTimeKnown ? ('full' as const) : ('partial' as const),
    primary,
    alternative,
    caratGuidance,
    explanation,
    explanationSource,
  };
}
