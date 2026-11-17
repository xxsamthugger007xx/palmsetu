import { AiProvider } from '../ai/types';
import { BirthProfile } from '../types/astrology';
import { TAROT_SYSTEM_PROMPT } from '../ai/tarotSystemPrompt';
import { getCardOrThrow } from './catalogue';
import { findMatchingCombinations } from './combinations';
import { computeYesNoTendency } from './yesNo';
import { buildBirthChartPerspective } from './chartPersonalization';
import { CardInterpretation, ReadingCategory, SpreadType, TarotDraw, TarotInterpretation, YesNoResult } from '../types/tarot';

const STATIC_MODEL_VERSION = 'static-fallback-v1';

/**
 * Grounding text for established card combinations present in this exact
 * draw, if any. This always takes precedence over anything the AI might
 * synthesize on its own - the prompt instructs the model accordingly. When
 * no combination matches, the AI is explicitly told it may synthesize a
 * relational reading from the individual cards instead, but must present
 * that as its own synthesis, not as an established combination.
 */
function combinationGroundingText(draws: TarotDraw[]): string {
  const matches = findMatchingCombinations(draws);
  if (matches.length === 0) {
    return (
      'No established traditional combination from the curated knowledge base matches this exact set of cards. ' +
      'You may synthesize a relational reading from the individual card meanings and position context, but make ' +
      'clear in your wording (e.g. "together these suggest...") that this is your own synthesis, not a fixed, ' +
      'traditionally-established combination.'
    );
  }
  const lines = matches
    .map((m) => `- Established combination (traditional/established): ${m.interpretation}`)
    .join('\n');
  return (
    `The following established, traditionally-sourced card combinations are present in this exact reading. ` +
    `Treat these as authoritative grounding: incorporate them faithfully into your synthesis and do not contradict them.\n${lines}`
  );
}

/** Extra instruction for how the AI's OVERALL synthesis must handle
 * multi-card relationships, scaled to spread size and tailored for the
 * Celtic Cross's specific position pairs. Per-card blurbs are never a
 * substitute for this - larger spreads must read as one connected reading. */
function relationalSynthesisInstruction(draws: TarotDraw[], spreadType: SpreadType | undefined): string {
  if (draws.length < 3) return '';
  let text =
    `\nThis spread has ${draws.length} cards: your OVERALL synthesis must explicitly address how these cards ` +
    `relate to, reinforce, or create tension with each other - never write ${draws.length} unrelated descriptions ` +
    `stitched together.`;
  if (spreadType === 'celtic-cross') {
    text +=
      ` This is a Celtic Cross specifically: pay particular attention to the relationship between the "Present" ` +
      `card and the "Challenge" card that crosses it (how the challenge complicates or interacts with the present ` +
      `situation), and weave an explicit connection between the "Hopes & Fears" card and the final "Outcome" card.`;
  }
  return text;
}

function categoryText(card: ReturnType<typeof getCardOrThrow>, category: ReadingCategory): string {
  switch (category) {
    case 'love': return card.love;
    case 'career': return card.career;
    case 'question':
    case 'general':
    default: return card.general;
  }
}

/** Builds the Yes/No spread's distinct static response shape - never the
 * generic card/overall/reflection shape used by every other spread. Fully
 * deterministic and AI-free, matching the "traditional card basis" framing:
 * the tendency itself is never left to an AI to invent. */
export function buildStaticYesNo(draw: TarotDraw): YesNoResult {
  const card = getCardOrThrow(draw.cardId);
  const tendency = computeYesNoTendency(draw.cardId, draw.orientation, card.rank);
  const traditionalBasis =
    `${card.name} (${draw.orientation}) traditionally leans toward "${tendency}" in a quick single-card yes/no draw. ` +
    `This is a simplified traditional convention, not a certainty - read the context and advice below alongside it.`;
  const context = draw.orientation === 'upright' ? card.general : card.reversedGeneral;
  const advice = card.reflectionPrompt;
  return { tendency, traditionalBasis, context, advice };
}

/** Deterministic, AI-free interpretation built entirely from validated card data.
 * This is the guaranteed fallback - it never fails and never fabricates meaning.
 * When spreadType is 'yes-no', also attaches the distinct YesNoResult shape. */
export function buildStaticInterpretation(draws: TarotDraw[], category: ReadingCategory, spreadType?: SpreadType): TarotInterpretation {
  const cardInterpretations: CardInterpretation[] = draws.map((draw) => {
    const card = getCardOrThrow(draw.cardId);
    const base = draw.orientation === 'upright' ? categoryText(card, category) : card.reversedGeneral;
    return {
      positionIndex: draw.positionIndex,
      cardId: draw.cardId,
      text: `${draw.positionName}: ${card.name} (${draw.orientation}) - ${base}`,
    };
  });

  const overallInterpretation =
    draws.length === 1
      ? 'This single card offers a focused point of reflection for the question or moment in mind.'
      : 'Taken together, these cards trace a traditional arc worth sitting with rather than a fixed outcome - notice how each position builds on the last.';

  const reflectionPrompts = draws
    .slice(0, 3)
    .map((d) => getCardOrThrow(d.cardId).reflectionPrompt);

  return {
    cardInterpretations,
    overallInterpretation,
    reflectionPrompts,
    ...(spreadType === 'yes-no' && draws.length > 0 ? { yesNo: buildStaticYesNo(draws[0]) } : {}),
    modelVersion: STATIC_MODEL_VERSION,
    createdAt: new Date().toISOString(),
  };
}

function buildAiPrompt(draws: TarotDraw[], category: ReadingCategory, question: string | null, spreadType?: SpreadType): string {
  const cardLines = draws
    .map((d) => {
      const card = getCardOrThrow(d.cardId);
      const meaning = d.orientation === 'upright' ? categoryText(card, category) : card.reversedGeneral;
      return `Position "${d.positionName}" (#${d.positionIndex}): ${card.name}, ${d.orientation}. Validated meaning: ${meaning} Keywords: ${(d.orientation === 'upright' ? card.uprightKeywords : card.reversedKeywords).join(', ')}.`;
    })
    .join('\n');

  return (
    `Reading category: ${category}.\n` +
    (question ? `User's question: "${question}"\n` : '') +
    `Cards drawn:\n${cardLines}\n\n` +
    `${combinationGroundingText(draws)}${relationalSynthesisInstruction(draws, spreadType)}\n\n` +
    `Respond in exactly this format:\n` +
    draws.map((d) => `CARD ${d.positionIndex}: <2-3 sentence interpretation for this position>`).join('\n') +
    `\nOVERALL: <3-5 sentence synthesis relating the cards to each other and the category/question>\n` +
    `QUESTIONS: <question 1> | <question 2> | <question 3>`
  );
}

/** Rejects obvious non-answers: our own prompt scaffold echoed back (angle-bracket
 * placeholders), or suspiciously short text. A provider that echoes the prompt
 * (e.g. a naive mock) must never be mistaken for a real, parsed interpretation. */
export function looksLikeRealAnswer(text: string): boolean {
  if (text.includes('<') || text.includes('>')) return false;
  if (text.trim().length < 8) return false;
  return true;
}

/**
 * Extracts the content after `LABEL:` up to the next recognized label (or
 * end of string), tolerant of the formatting variations real LLM output
 * actually produces: markdown emphasis around the label (`**OVERALL:**`),
 * extra whitespace, and content that wraps across multiple lines instead
 * of staying on one line after the label. This replaces a previous
 * implementation that only matched a single line via `.+`, which broke on
 * any multi-line wrapped section.
 */
function extractSection(text: string, label: string, allLabels: string[]): string | null {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = allLabels.map(escape).join('|');
  const re = new RegExp(
    `\\**\\s*${escape(label)}\\s*\\**\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*\\**\\s*(?:${boundary})\\s*\\**\\s*:|$)`,
    'i',
  );
  const match = text.match(re);
  if (!match) return null;
  // Strip any leading markdown emphasis markers left over right after the
  // colon (e.g. "OVERALL: **some text**" or "**OVERALL:** some text").
  return match[1].trim().replace(/^\*+\s*/, '').replace(/\*+$/, '').trim();
}

function parseAiResponse(text: string, draws: TarotDraw[], spreadType?: SpreadType): TarotInterpretation | null {
  try {
    const labels = [...draws.map((d) => `CARD ${d.positionIndex}`), 'OVERALL', 'QUESTIONS'];
    const cardInterpretations: CardInterpretation[] = [];
    for (const draw of draws) {
      const content = extractSection(text, `CARD ${draw.positionIndex}`, labels);
      if (!content || !looksLikeRealAnswer(content)) return null;
      cardInterpretations.push({ positionIndex: draw.positionIndex, cardId: draw.cardId, text: content });
    }

    const overall = extractSection(text, 'OVERALL', labels);
    const questions = extractSection(text, 'QUESTIONS', labels);
    if (!overall || !questions || !looksLikeRealAnswer(overall)) return null;

    const reflectionPrompts = questions
      .split('|')
      .map((q) => q.trim())
      .filter((q) => looksLikeRealAnswer(q));
    if (reflectionPrompts.length === 0) return null;

    return {
      cardInterpretations,
      overallInterpretation: overall,
      reflectionPrompts,
      ...(spreadType === 'yes-no' && draws.length > 0 ? { yesNo: buildStaticYesNo(draws[0]) } : {}),
      modelVersion: 'ai-v1',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Generates an AI-enhanced interpretation of the already-drawn cards, with a
 * guaranteed static fallback if the AI call fails or returns an unparseable response.
 * For the 'yes-no' spread, the tendency itself always comes from the deterministic
 * static computation (buildStaticYesNo) - the AI never invents it, only the
 * surrounding narrative in cardInterpretations/overallInterpretation. */
export async function generateInterpretation(
  draws: TarotDraw[],
  category: ReadingCategory,
  question: string | null,
  aiProvider: AiProvider,
  spreadType?: SpreadType,
): Promise<TarotInterpretation> {
  try {
    const raw = await aiProvider.complete(
      [
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        { role: 'user', content: buildAiPrompt(draws, category, question, spreadType) },
      ],
      { feature: 'tarot', operation: 'interpretation' },
    );
    const parsed = parseAiResponse(raw, draws, spreadType);
    if (parsed) return parsed;
  } catch (err) {
    console.warn('[tarot] AI interpretation failed, falling back to static meanings:', err);
  }

  return buildStaticInterpretation(draws, category, spreadType);
}

function buildDetailedPrompt(draws: TarotDraw[], category: ReadingCategory, question: string | null, spreadType?: SpreadType): string {
  const cardLines = draws
    .map((d) => {
      const card = getCardOrThrow(d.cardId);
      const meaning = d.orientation === 'upright' ? categoryText(card, category) : card.reversedGeneral;
      return `Position "${d.positionName}" (#${d.positionIndex}): ${card.name}, ${d.orientation}. Validated meaning: ${meaning} Symbolism: ${card.symbolism}`;
    })
    .join('\n');

  return (
    `This is a PREMIUM detailed reading request - the user has unlocked a deeper, cohesive synthesis ` +
    `across all their selected cards, not isolated per-card blurbs.\n` +
    `Reading category: ${category}.\n` +
    (question ? `User's question: "${question}"\n` : '') +
    `Cards drawn:\n${cardLines}\n\n` +
    `${combinationGroundingText(draws)}${relationalSynthesisInstruction(draws, spreadType)}\n\n` +
    `IMPORTANT LENGTH RULE: you MUST include all ${draws.length + 3} sections below, in order, and finish with ` +
    `the QUESTIONS line - a response that gets cut off before QUESTIONS is useless even if the earlier sections ` +
    `are excellent. Keep each CARD section to 2-3 sentences (not 3-4) and OVERALL to 4-5 sentences (not 5-7) so ` +
    `the complete response fits comfortably within the available length. Do not use markdown formatting (no ** or #).\n\n` +
    `Respond in exactly this format, with no text before CARD 0 or after the QUESTIONS line:\n` +
    draws.map((d) => `CARD ${d.positionIndex}: <2-3 sentence detailed interpretation of this card in its position, including symbolism and how it relates to the question/category>`).join('\n') +
    `\nOVERALL: <a coherent 4-5 sentence synthesis covering the overall theme of the spread, how the cards connect or contrast with each other, and a concluding summary - written as one flowing reading, not a list>\n` +
    `SUGGESTIONS: <short practical suggestion 1> | <short practical suggestion 2> | <short practical suggestion 3>\n` +
    `QUESTIONS: <short reflection question 1> | <short reflection question 2> | <short reflection question 3>`
  );
}

/** Scaled so larger spreads (which need more CARD sections) get a budget
 * that can actually fit the complete required structure - a flat 800-token
 * cap (fine for the short assistant chat path this same provider also
 * serves) was truncating detailed reports before they ever reached the
 * SUGGESTIONS/QUESTIONS lines the parser requires, causing every detailed
 * report to fail with GENERATION_FAILED regardless of spread size. ~280
 * tokens per card comfortably covers a 2-3 sentence section plus the fixed
 * OVERALL/SUGGESTIONS/QUESTIONS overhead, capped so a pathological case
 * can't run unbounded.
 */
function detailedReportTokenBudget(cardCount: number): number {
  return Math.min(4000, 900 + cardCount * 280);
}

function parseDetailedResponse(text: string, draws: TarotDraw[]): TarotInterpretation | null {
  try {
    const labels = [...draws.map((d) => `CARD ${d.positionIndex}`), 'OVERALL', 'SUGGESTIONS', 'QUESTIONS'];
    const cardInterpretations: CardInterpretation[] = [];
    for (const draw of draws) {
      const content = extractSection(text, `CARD ${draw.positionIndex}`, labels);
      if (!content || !looksLikeRealAnswer(content)) return null;
      cardInterpretations.push({ positionIndex: draw.positionIndex, cardId: draw.cardId, text: content });
    }

    const overall = extractSection(text, 'OVERALL', labels);
    const suggestions = extractSection(text, 'SUGGESTIONS', labels);
    const questions = extractSection(text, 'QUESTIONS', labels);
    if (!overall || !suggestions || !questions) return null;
    if (!looksLikeRealAnswer(overall)) return null;

    const practicalSuggestions = suggestions.split('|').map((s) => s.trim()).filter((s) => looksLikeRealAnswer(s));
    const reflectionPrompts = questions.split('|').map((q) => q.trim()).filter((q) => looksLikeRealAnswer(q));
    if (practicalSuggestions.length === 0 || reflectionPrompts.length === 0) return null;

    return {
      cardInterpretations,
      overallInterpretation: overall,
      reflectionPrompts,
      practicalSuggestions,
      modelVersion: 'ai-detailed-v1',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Premium-only cohesive multi-card synthesis. Unlike generateInterpretation
 * (which silently falls back to static content), this has NO silent fallback -
 * the caller must treat a null return as a genuine generation failure and
 * surface it, since a user who paid for this expects either the real thing or
 * an honest error, not a quietly degraded free-tier substitute.
 */
export async function generateDetailedReport(
  draws: TarotDraw[],
  category: ReadingCategory,
  question: string | null,
  aiProvider: AiProvider,
  spreadType?: SpreadType,
  birthProfile?: BirthProfile | null,
): Promise<TarotInterpretation | null> {
  try {
    const raw = await aiProvider.complete(
      [
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        { role: 'user', content: buildDetailedPrompt(draws, category, question, spreadType) },
      ],
      { feature: 'tarot', operation: 'detailed_report', maxOutputTokens: detailedReportTokenBudget(draws.length) },
    );
    const parsed = parseDetailedResponse(raw, draws);
    if (!parsed) return null;
    return { ...parsed, birthChartPerspective: buildBirthChartPerspective(draws, birthProfile ?? null) };
  } catch (err) {
    console.warn('[tarot] Detailed report generation failed:', err);
    return null;
  }
}
