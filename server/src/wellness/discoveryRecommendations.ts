import { DiscoveryAnswer } from '../types/wellness';
import { findDiscoveryQuestion } from './discoveryQuestions';

/**
 * Smart personalization hints (spec Part 9). Deliberately deterministic, not
 * AI-generated: this only maps real answered values onto REAL, already-
 * existing wellness features (breathing techniques, meditation categories,
 * challenges) - it never invents a feature that does not exist elsewhere in
 * this app. Exposed as its own GET /wellness/discovery/recommendations
 * endpoint (rather than folded into the insight response) so the frontend
 * can show/refresh it independently of whether an AI insight was generated -
 * recommendations are purely rule-based and have no AI-call cost, so there
 * is no reason to couple their availability to the insight endpoint.
 */
export interface DiscoveryRecommendation {
  type: 'breathing' | 'meditation' | 'journal_prompt' | 'habit' | 'challenge';
  reason: string;
  /** Points at a real catalogue id/category where one exists, so the
   * frontend can deep-link instead of guessing. */
  refId?: string;
}

export function buildRecommendations(answers: DiscoveryAnswer[]): DiscoveryRecommendation[] {
  const recs: DiscoveryRecommendation[] = [];

  const scaleAnswers = answers.filter((a) => typeof a.value === 'number' && !a.skipped);
  const lowEnergyOrHighStress = scaleAnswers.some((a) => (a.value as number) <= 2 && findDiscoveryQuestion(a.questionId)?.category === 'mental-energy');
  if (lowEnergyOrHighStress) {
    recs.push({
      type: 'breathing',
      reason: 'You reported low mental energy today - a short breathing session can help settle your nervous system before you do anything else.',
      refId: 'box',
    });
  }

  const needsAnswer = answers.find((a) => !a.skipped && findDiscoveryQuestion(a.questionId)?.category === 'emotional-needs');
  if (needsAnswer) {
    const value = String(needsAnswer.value).toLowerCase();
    if (value.includes('rest') || value.includes('space') || value.includes('stillness') || value.includes('wind-down')) {
      recs.push({ type: 'meditation', reason: 'You said you need rest or space today - a short sleep or relaxation meditation may help.', refId: 'relaxation' });
    } else if (value.includes('connection') || value.includes('heard') || value.includes('closeness')) {
      recs.push({ type: 'journal_prompt', reason: 'You said connection is what you need most - a relationship-reflection journal prompt might help you process that.', refId: 'relationship-reflection' });
    } else if (value.includes('clarity') || value.includes('focus')) {
      recs.push({ type: 'meditation', reason: 'You said clarity or focus is what you need - a focus meditation may help.', refId: 'focus' });
    }
  }

  const moodInfluences = answers.filter((a) => !a.skipped && findDiscoveryQuestion(a.questionId)?.category === 'mood-influences' && Array.isArray(a.value));
  const mentionedLoneliness = moodInfluences.some((a) => (a.value as string[]).some((v) => v.toLowerCase().includes('loneliness')));
  if (mentionedLoneliness) {
    recs.push({ type: 'journal_prompt', reason: 'Loneliness came up today - a gratitude or reflection prompt focused on connection might be worth a few minutes.', refId: 'relationship-reflection' });
  }
  const mentionedWorkOrDeadlines = moodInfluences.some((a) => (a.value as string[]).some((v) => /work|deadline/i.test(v)));
  if (mentionedWorkOrDeadlines) {
    recs.push({ type: 'habit', reason: 'Work pressure came up today - a short daily habit (even a 5-minute one) can give you a small sense of control amid it.', refId: undefined });
  }

  const gratitudeAnswered = answers.some((a) => !a.skipped && findDiscoveryQuestion(a.questionId)?.category === 'gratitude' && typeof a.value === 'string' && (a.value as string).trim().length > 0);
  if (gratitudeAnswered) {
    recs.push({ type: 'challenge', reason: "You engaged with today's gratitude question - the 7-day gratitude challenge builds on that same habit.", refId: '7-day-gratitude' });
  }

  // De-duplicate by type+refId and cap at a reasonable list length.
  const seen = new Set<string>();
  return recs.filter((r) => {
    const key = `${r.type}:${r.refId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}
