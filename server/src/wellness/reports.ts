import { journalDay } from '../types/wellness';
import {
  moodEntriesByUserDate, journalEntriesById, discoveryAnswersByKey, habitCompletionsByKey,
  breathingSessionsById, meditationSessionsById, wellnessGoalsById,
} from '../data/store';
import { MoodEntry, MoodLevel, WeeklyReport, MonthlyReport } from '../types/wellness';
import { findDiscoveryQuestion } from './discoveryQuestions';

/** Mood -> 1-5 numeric scale for averaging, real and documented (never
 * exposed to the user as a "score", only used internally for averages/
 * highest/lowest-day comparisons). */
const MOOD_SCORE: Record<MoodLevel, number> = { low: 1, down: 2, okay: 3, good: 4, great: 5 };

/** Monday-start local week convention, chosen for consistency with how most
 * users plan a "week" (vs. Sunday-start) - documented here since the spec
 * left the exact boundary to this implementation's judgment. `weekStart`
 * must be the Monday of the week being reported (YYYY-MM-DD, UTC-based date
 * arithmetic, same deliberate-UTC-date-string approach as routes/wellness.ts's
 * addDaysToDateString, to avoid local-TZ off-by-one bugs). */
function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const deltaToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, deltaToMonday);
}

function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function userMoodEntriesInRange(userId: string, from: string, to: string): MoodEntry[] {
  return moodEntriesByUserDate.valuesForUser(userId)
    .filter((e) => e.localDate >= from && e.localDate <= to)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
}

/**
 * Real, deterministically-computed weekly report. No AI call is required for
 * the numbers themselves - everything here is arithmetic over real stored
 * records. Positive-moment excerpts are pulled verbatim (never paraphrased).
 * Recommendations/goals/mindful-of entries are template sentences filled in
 * with real computed values - no free-form AI phrasing is used, so there is
 * nothing for AI to hallucinate and no AI-call cost for this feature. This
 * keeps the "deterministic-first, AI only for phrasing of verified facts"
 * discipline while being honest that, for this report, even the phrasing is
 * deterministic (a judgment call: the facts here are already simple enough
 * that templated sentences are more reliable and auditable than an AI call).
 */
export function computeWeeklyReport(userId: string, weekStart: string): WeeklyReport {
  const weekEnd = addDays(weekStart, 6);
  const dates = weekDates(weekStart);
  const moods = userMoodEntriesInRange(userId, weekStart, weekEnd);
  const moodByDate = new Map(moods.map((m) => [m.localDate, m]));

  const moodSequence = dates.map((localDate) => ({ localDate, mood: moodByDate.get(localDate)?.mood ?? null }));
  const scores = moods.map((m) => MOOD_SCORE[m.mood]);
  const averageMood = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;

  let highestMoodDay: string | null = null;
  let lowestMoodDay: string | null = null;
  if (moods.length > 0) {
    const highest = moods.reduce((a, b) => (MOOD_SCORE[b.mood] > MOOD_SCORE[a.mood] ? b : a));
    const lowest = moods.reduce((a, b) => (MOOD_SCORE[b.mood] < MOOD_SCORE[a.mood] ? b : a));
    highestMoodDay = highest.localDate;
    lowestMoodDay = lowest.localDate;
  }

  const answers = [...discoveryAnswersByKey.values()].filter(
    (a) => a.userId === userId && a.localDate >= weekStart && a.localDate <= weekEnd && !a.skipped,
  );

  const influenceCounts = new Map<string, number>();
  const influenceDatesByLabel = new Map<string, Set<string>>();
  for (const a of answers) {
    const q = findDiscoveryQuestion(a.questionId);
    if (q?.category !== 'mood-influences' || !Array.isArray(a.value)) continue;
    for (const label of a.value as string[]) {
      influenceCounts.set(label, (influenceCounts.get(label) ?? 0) + 1);
      if (!influenceDatesByLabel.has(label)) influenceDatesByLabel.set(label, new Set());
      influenceDatesByLabel.get(label)!.add(a.localDate);
    }
  }
  const topMoodInfluences = [...influenceCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Positive moments: real gratitude answer excerpts + favorited journal
  // entries from this week, verbatim.
  const gratitudeExcerpts = answers
    .filter((a) => findDiscoveryQuestion(a.questionId)?.category === 'gratitude' && typeof a.value === 'string' && (a.value as string).trim().length > 0)
    .map((a) => (a.value as string).trim());
  const favoritedJournal = journalEntriesById.valuesForUser(userId)
    .filter((j) => j.favorite && !j.deletedAt && journalDay(j) >= weekStart && journalDay(j) <= weekEnd)
    .map((j) => j.content.slice(0, 280));
  const positiveMoments = [...gratitudeExcerpts, ...favoritedJournal];

  // Recommendations/next-week goals - template-filled from real stats, with
  // a general fallback when a week's data does not confidently support a
  // specific pattern (per spec: never fabricate a precise-sounding but
  // ungrounded recommendation).
  const recommendations: string[] = [];
  const nextWeekGoals: string[] = [];
  if (averageMood !== null && averageMood < 3) {
    recommendations.push('Your average mood this week was on the lower side - consider a short daily check-in with a breathing or meditation session to support yourself.');
    nextWeekGoals.push('Try one breathing or meditation session on at least 3 days next week.');
  } else if (averageMood !== null) {
    recommendations.push('Your mood held up reasonably well this week - keep noting what is working for you.');
    nextWeekGoals.push('Keep up your current mood check-in routine next week.');
  } else {
    recommendations.push('Checking in on your mood, even briefly, helps build a clearer picture over time.');
    nextWeekGoals.push('Try logging your mood at least 3 times next week.');
  }
  if (topMoodInfluences.length > 0) {
    recommendations.push(`"${topMoodInfluences[0].label}" came up often this week - a journal entry reflecting on it might help.`);
  } else {
    recommendations.push('Try a journal entry this week, even a short one, to capture what is on your mind.');
  }
  if (moods.length < 3) {
    recommendations.push('You checked in fewer than 3 times this week - more frequent check-ins give you a more complete picture of your patterns.');
  } else {
    recommendations.push('You checked in consistently this week - that consistency is valuable data about yourself.');
  }
  nextWeekGoals.push('Answer at least one Daily Discovery question most days next week.');
  nextWeekGoals.push('Revisit this report next week to see what changed.');

  // "Things to be mindful of" - soft, correlational language only, built
  // from a real pattern: an influence selected on 3+ days alongside a
  // below-average mood day. Never presented as a proven cause.
  const thingsToDoMore: string[] = [];
  const mindfulOf: string[] = [];
  for (const { label, count } of topMoodInfluences) {
    if (count >= 3) {
      const datesWithLabel = influenceDatesByLabel.get(label) ?? new Set();
      const lowMoodDaysWithLabel = moods.filter((m) => datesWithLabel.has(m.localDate) && averageMood !== null && MOOD_SCORE[m.mood] < averageMood);
      if (lowMoodDaysWithLabel.length >= 2) {
        mindfulOf.push(`"${label}" showed up on ${count} days this week, often alongside a lower mood - this is a pattern worth noticing, not a proven cause, but it may be worth gently keeping an eye on.`);
      } else {
        thingsToDoMore.push(`Whatever has been supporting you alongside "${label}" being on your mind this week seems to be working - worth continuing.`);
      }
    }
  }
  if (gratitudeExcerpts.length > 0) thingsToDoMore.push('You engaged with gratitude reflection this week - this is a practice worth continuing.');
  if (thingsToDoMore.length === 0) thingsToDoMore.push('Keep showing up for your check-ins, however small - consistency itself is the thing to do more of.');
  if (mindfulOf.length === 0) mindfulOf.push('No strong patterns stood out this week between specific influences and lower mood days.');

  return {
    userId,
    weekStart,
    weekEnd,
    generatedAt: new Date().toISOString(),
    moodSequence,
    averageMood,
    highestMoodDay,
    lowestMoodDay,
    checkInCount: moods.length,
    topMoodInfluences,
    positiveMoments,
    recommendations,
    nextWeekGoals,
    thingsToDoMore,
    mindfulOf,
    aiSummaryUsed: false,
  };
}

export function computeMonthlyReport(userId: string, month: string): MonthlyReport {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;

  const moods = userMoodEntriesInRange(userId, from, to);
  const scores = moods.map((mo) => MOOD_SCORE[mo.mood]);
  const averageMood = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;

  let moodTrend: MonthlyReport['moodTrend'] = 'insufficient-data';
  if (moods.length >= 4) {
    const mid = Math.floor(moods.length / 2);
    const firstHalfAvg = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalfAvg = scores.slice(mid).reduce((a, b) => a + b, 0) / (scores.length - mid);
    const diff = secondHalfAvg - firstHalfAvg;
    moodTrend = diff > 0.3 ? 'improving' : diff < -0.3 ? 'declining' : 'steady';
  }

  const breathing = breathingSessionsById.valuesForUser(userId).filter((s) => s.completed && s.createdAt.slice(0, 10) >= from && s.createdAt.slice(0, 10) <= to).length;
  const meditation = meditationSessionsById.valuesForUser(userId).filter((s) => s.completed && s.startedAt.slice(0, 10) >= from && s.startedAt.slice(0, 10) <= to).length;
  const habitCompletions = habitCompletionsByKey.valuesForUser(userId).filter((c) => c.localDate >= from && c.localDate <= to).length;
  const activitiesCompleted = breathing + meditation + habitCompletions;

  const answers = discoveryAnswersByKey.valuesForUser(userId).filter((a) => a.localDate >= from && a.localDate <= to && !a.skipped);
  const influenceCounts = new Map<string, number>();
  for (const a of answers) {
    const q = findDiscoveryQuestion(a.questionId);
    if (q?.category !== 'mood-influences' || !Array.isArray(a.value)) continue;
    for (const label of a.value as string[]) influenceCounts.set(label, (influenceCounts.get(label) ?? 0) + 1);
  }
  const topMoodInfluenceThemes = [...influenceCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  const journalEntryCount = journalEntriesById.valuesForUser(userId).filter((j) => !j.deletedAt && !j.isDraft && journalDay(j) >= from && journalDay(j) <= to).length;
  const goalsCompleted = wellnessGoalsById.valuesForUser(userId).filter((g) => g.status === 'completed' && g.completedAt && g.completedAt.slice(0, 10) >= from && g.completedAt.slice(0, 10) <= to).length;

  return {
    userId,
    month,
    generatedAt: new Date().toISOString(),
    checkInCount: moods.length,
    averageMood,
    moodTrend,
    activitiesCompleted,
    topMoodInfluenceThemes,
    journalEntryCount,
    goalsCompleted,
  };
}
