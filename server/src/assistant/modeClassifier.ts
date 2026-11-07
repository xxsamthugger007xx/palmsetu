import { GenerationOptions } from '../ai/types';

export type AssistantMode = 'fast' | 'deep_analysis' | 'premium_report';

/**
 * Lightweight rule-based mode classification - deliberately NOT an extra AI
 * call. Running a second model request just to decide how to run the first
 * one would add real network latency to every message, defeating the whole
 * point of a fast default path. Keyword/heuristic matching is instant, free,
 * and good enough: when uncertain, this always falls back to 'fast' per the
 * task's own instruction ("if uncertain, default to FAST MODE").
 */
const DEEP_ANALYSIS_KEYWORDS = [
  'detailed', 'in-depth', 'in depth', 'comprehensive', 'complete analysis', 'full analysis',
  'dasha', 'marriage', 'compare', 'comparison', 'multiple placements', 'career analysis',
  'relationship analysis', 'deep dive', 'thorough', 'explain everything', 'all the details',
];

const PREMIUM_REPORT_KEYWORDS = [
  'full report', 'premium report', 'detailed report', 'complete report', 'unlock',
  'pdf report', 'the full reading', 'entire reading',
];

/**
 * Classifies a message into a processing mode. `hasPremiumUpsell` comes from
 * the entitlement check that already ran for this feature/user, so this
 * never re-derives entitlement logic - it only decides how much reasoning
 * budget/output length to spend on the (always free-data-only, never
 * locked-content) reply that will actually be generated.
 */
export function classifyMode(message: string, hasPremiumUpsell: boolean): AssistantMode {
  const text = message.toLowerCase();

  const mentionsPremiumReport = PREMIUM_REPORT_KEYWORDS.some((kw) => text.includes(kw));
  if (mentionsPremiumReport && hasPremiumUpsell) {
    return 'premium_report';
  }

  if (DEEP_ANALYSIS_KEYWORDS.some((kw) => text.includes(kw))) {
    return 'deep_analysis';
  }

  // A long, multi-clause question is also a reasonable signal that the user
  // wants more than a one-line answer, without requiring a specific keyword.
  if (message.length > 220) {
    return 'deep_analysis';
  }

  return 'fast';
}

/**
 * Per-mode Gemini generation config. 'premium_report' intentionally uses the
 * same fast/concise config as 'fast' - this mode never generates the actual
 * locked report content inline (that stays in the dedicated premium-report
 * endpoints, e.g. /tarot/readings/:id/detailed-report), it only affects
 * which analytics bucket the chat reply is logged under and, via the prompt,
 * how clearly it points the user at the real premium flow. Only
 * 'deep_analysis' actually gets more reasoning budget and output room.
 */
export function generationOptionsForMode(mode: AssistantMode): GenerationOptions {
  if (mode === 'deep_analysis') {
    return { thinkingLevel: 'high', maxOutputTokens: 1600 };
  }
  return { thinkingLevel: 'low', maxOutputTokens: 800 };
}
