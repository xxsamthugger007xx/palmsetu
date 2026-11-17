import { AiProvider } from '../ai/types';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { DiscoveryAnswer, MoodEntry } from '../types/wellness';
import { findDiscoveryQuestion } from './discoveryQuestions';

/**
 * Today's Insight (spec Part 2/#2). Two-tier, matching this app's existing
 * deterministic-first architecture (staticPalmistryEngine/premiumPalmistryEngine
 * precedent): facts are always real stored mood + discovery answers, never
 * invented; AI (through SanitizingProvider, passed in as `aiProvider`) is
 * only ever used to phrase a sentence FROM those facts, never to supply new
 * facts. If there is not enough real data, a curated generic supportive
 * message is returned and the AI provider is never called - this is the
 * exact behavior asserted by the "zero AI calls when insufficient data"
 * test in routes/wellness.test.ts.
 */

const GENERIC_SUPPORTIVE_MESSAGES = [
  "Thanks for checking in today. Even a small check-in counts - come back whenever you're ready to share a bit more.",
  'Every day you show up for yourself matters, even the quiet ones. There is no pressure to have more to say than you do.',
  "It's okay if today was a light one. Taking even a moment for yourself is worth noticing.",
  'However today went, you took a moment to pause and notice it - that is enough on its own.',
];

export interface InsightResult {
  insight: string;
  tier: 'insufficient-data' | 'generated' | 'crisis';
  aiCallMade: boolean;
}

/** Minimum real signal required before attempting an AI-phrased insight:
 * at least one non-skipped discovery answer today, in addition to the
 * mood entry. A mood-only quick tap ("great"/5/5/5, no discovery answers)
 * is explicitly treated as insufficient per spec ("if there is insufficient
 * information, provide a supportive general message instead of inventing
 * an insight"). */
function hasSufficientData(mood: MoodEntry | undefined, answers: DiscoveryAnswer[]): boolean {
  const realAnswers = answers.filter((a) => !a.skipped);
  return Boolean(mood) && realAnswers.length > 0;
}

function collectFreeText(answers: DiscoveryAnswer[]): string[] {
  return answers
    .filter((a) => !a.skipped && typeof a.value === 'string' && findDiscoveryQuestion(a.questionId)?.type === 'text')
    .map((a) => a.value as string)
    .filter((t) => t.trim().length > 0);
}

function pickGenericMessage(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GENERIC_SUPPORTIVE_MESSAGES[hash % GENERIC_SUPPORTIVE_MESSAGES.length];
}

export async function generateTodaysInsight(
  aiProvider: AiProvider,
  userId: string,
  localDate: string,
  mood: MoodEntry | undefined,
  answers: DiscoveryAnswer[],
): Promise<InsightResult> {
  // Crisis check runs on every free-text answer BEFORE anything else - if
  // any flags, skip insight generation entirely and return the existing
  // CRISIS_RESPONSE framing, same as every other AI route in this app.
  const freeTexts = collectFreeText(answers);
  if (freeTexts.some((t) => containsCrisisLanguage(t))) {
    return { insight: CRISIS_RESPONSE, tier: 'crisis', aiCallMade: false };
  }

  if (!hasSufficientData(mood, answers)) {
    return { insight: pickGenericMessage(`${userId}:${localDate}`), tier: 'insufficient-data', aiCallMade: false };
  }

  const facts: string[] = [];
  if (mood) facts.push(`User's mood check-in today: mood=${mood.mood}, energy=${mood.energy}/5, stress=${mood.stress}/5.`);
  for (const a of answers) {
    if (a.skipped) continue;
    const question = findDiscoveryQuestion(a.questionId);
    if (!question) continue;
    if (question.type === 'multi-select' && Array.isArray(a.value)) {
      facts.push(`User selected for "${question.prompt}": ${a.value.join(', ')}.`);
    } else if (question.type === 'scale' && typeof a.value === 'number') {
      facts.push(`User rated "${question.prompt}" as ${a.value}/${question.scaleMax ?? 5}.`);
    } else if (typeof a.value === 'string' && a.value.trim().length > 0) {
      facts.push(`User answered "${question.prompt}" with: "${a.value.trim()}".`);
    }
  }

  const prompt = [
    'Below are facts a user explicitly reported about themselves today, and only these facts.',
    facts.join('\n'),
    '',
    'Write ONE short, warm, non-diagnostic insight (1-2 sentences) grounded ONLY in the facts above.',
    'Never claim information beyond what is given. Never diagnose a mental or physical condition.',
    'Never make medical claims. Do not invent facts the user did not report. Keep it supportive and specific to these facts.',
  ].join('\n');

  const reply = await aiProvider.complete([
    { role: 'system', content: 'You are a warm, nonjudgmental wellness companion. You never diagnose and never invent information about the user.' },
    { role: 'user', content: prompt },
  ]);

  return { insight: reply, tier: 'generated', aiCallMade: true };
}
