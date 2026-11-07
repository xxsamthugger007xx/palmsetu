import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { AiProvider } from '../ai/types';
import { containsCrisisLanguage, CRISIS_RESPONSE } from '../ai/crisisDetection';
import { classifyMode, generationOptionsForMode } from '../assistant/modeClassifier';
import {
  moodEntriesByUserDate, journalEntriesById, breathingSessionsById, habitsById,
  habitCompletionsByKey, challengeProgressByKey, meditationSessionsById, wellnessGoalsById,
  inspirationHistoryByUser, wellnessFavoritesByUser, wellnessPreferencesByUser,
  wellnessAiConversationsById, getUserTier,
} from '../data/store';
import {
  EMOTION_OPTIONS, JOURNAL_ENTRY_TYPES, BREATHING_TECHNIQUES, WELLNESS_GOAL_CATEGORIES,
  MoodEntry, JournalEntry, BreathingSession, Habit, ChallengeProgress, WellnessGoal,
} from '../types/wellness';
import {
  MOOD_FREE_HISTORY_DAYS, moodHistoryWindowDays, MAX_FREE_HABITS, isHabitLimitReached,
  isChallengeAllowed, isBreathingTechniqueAllowed, FREE_JOURNAL_AI_DAILY_LIMIT,
  INSPIRATION_NO_REPEAT_DAYS, FREE_AI_COMPANION_DAILY_MESSAGES, PREMIUM_AI_COMPANION_DAILY_MESSAGES,
  JOURNAL_FREE_PROMPT_CATEGORIES,
} from '../wellness/entitlements';
import {
  BREATHING_TECHNIQUE_CATALOGUE, JOURNAL_PROMPTS, PREDEFINED_HABITS, CHALLENGES,
  MEDITATION_CATALOGUE, INSPIRATION_LIBRARY, findChallengeDefinition, findMeditationContent,
} from '../wellness/content';
import { recordWellnessEvent } from '../wellness/analytics';

/** Same TEMPORARY testing shim as every other route in this app: no real
 * auth exists yet, identity comes from the x-demo-user header. */
function currentUserId(req: any): string {
  return (req.headers['x-demo-user'] as string) || 'demo-user';
}

function localDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pure UTC date-string arithmetic, deliberately never mixed with local-time
 * Date mutation (setHours/setDate use the server process's local timezone,
 * while toISOString() always renders UTC - mixing the two can silently shift
 * "today" by a day depending on the server's TZ offset, which is exactly the
 * kind of bug that must not exist in streak math users rely on). */
function addDaysToDateString(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const WELLNESS_SYSTEM_PROMPT = `
You are not a licensed therapist, doctor, or medical professional, and must never claim to be one.
Never diagnose a mental or physical health condition.
You are Solune's wellness companion, a supportive guide for mood, habits, journaling, and daily wellbeing.
Your tone is warm, empathetic, nonjudgmental, and concise. Keep replies short (2-5 sentences) unless the user
asks for more detail. You may suggest breathing exercises, journaling prompts, and habit ideas already present
in the user's own wellness data, but you never fabricate progress or claim medical expertise.
`.trim();

export function buildWellnessRouter(aiProvider: AiProvider) {
  const router = Router();

  // =========================================================================
  // Mood Tracker
  // =========================================================================
  const moodSchema = z.object({
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mood: z.enum(['great', 'good', 'okay', 'down', 'low']),
    emotions: z.array(z.enum(EMOTION_OPTIONS)).max(15).optional(),
    energy: z.number().int().min(1).max(5),
    stress: z.number().int().min(1).max(5),
    sleepQuality: z.number().int().min(1).max(5),
    note: z.string().max(2000).optional(),
    tags: z.array(z.string().max(40)).max(10).optional(),
  });

  // Create-or-update-in-place for the day - idempotent-per-day, same pattern
  // as dailyTarotByUserDate/dailyHoroscopesByKey.
  router.post('/mood', (req, res) => {
    const parsed = moodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const userId = currentUserId(req);
    const key = `${userId}:${parsed.data.localDate}`;
    const existing = moodEntriesByUserDate.get(key);
    const now = new Date().toISOString();
    const entry: MoodEntry = {
      id: existing?.id ?? uuid(),
      userId,
      localDate: parsed.data.localDate,
      mood: parsed.data.mood,
      emotions: parsed.data.emotions ?? [],
      energy: parsed.data.energy,
      stress: parsed.data.stress,
      sleepQuality: parsed.data.sleepQuality,
      note: parsed.data.note,
      tags: parsed.data.tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    moodEntriesByUserDate.set(key, entry);
    if (!existing) {
      recordWellnessEvent(userId, 'mood_checkin_completed', { mood: entry.mood, emotionCount: entry.emotions.length });
    }
    res.json({ entry, wasUpdate: Boolean(existing) });
  });

  function userMoodEntries(userId: string): MoodEntry[] {
    return [...moodEntriesByUserDate.values()]
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.localDate.localeCompare(b.localDate));
  }

  // Returns a limited window of REAL entries for free tier (never fabricated
  // or truncated data - the underlying entries are never deleted).
  router.get('/mood/history', (req, res) => {
    const userId = currentUserId(req);
    const all = userMoodEntries(userId);
    const windowDays = moodHistoryWindowDays(userId);
    const visible = windowDays == null
      ? all
      : all.filter((e) => {
          const days = (Date.now() - new Date(e.localDate).getTime()) / 86400000;
          return days <= windowDays;
        });
    res.json({
      entries: visible.reverse(),
      freeHistoryWindowDays: windowDays,
      totalEntriesStored: all.length, // honest: older entries exist, just not returned
    });
  });

  function average(nums: number[]): number | null {
    if (nums.length === 0) return null;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
  }

  router.get('/mood/trends', (req, res) => {
    const userId = currentUserId(req);
    const windowDays = req.query.window === 'month' ? 30 : 7;
    const all = userMoodEntries(userId);
    const cutoff = Date.now() - windowDays * 86400000;
    const recent = all.filter((e) => new Date(e.localDate).getTime() >= cutoff);

    if (recent.length === 0) {
      return res.json({
        hasData: false,
        windowDays,
        message: 'No mood entries yet in this window.',
        moodDistribution: {}, emotionFrequency: {}, averageEnergy: null, averageStress: null, averageSleepQuality: null,
        checkInCount: 0,
      });
    }

    const moodDistribution: Record<string, number> = {};
    const emotionFrequency: Record<string, number> = {};
    for (const e of recent) {
      moodDistribution[e.mood] = (moodDistribution[e.mood] ?? 0) + 1;
      for (const em of e.emotions) emotionFrequency[em] = (emotionFrequency[em] ?? 0) + 1;
    }

    res.json({
      hasData: true,
      windowDays,
      checkInCount: recent.length,
      moodDistribution,
      emotionFrequency,
      averageEnergy: average(recent.map((e) => e.energy)),
      averageStress: average(recent.map((e) => e.stress)),
      averageSleepQuality: average(recent.map((e) => e.sleepQuality)),
    });
  });

  // Registered AFTER /mood/history and /mood/trends so those literal paths
  // are matched first - otherwise Express would match them against this
  // :localDate param route instead.
  router.get('/mood/:localDate', (req, res) => {
    const userId = currentUserId(req);
    const entry = moodEntriesByUserDate.get(`${userId}:${req.params.localDate}`);
    if (!entry) return res.status(404).json({ error: 'No mood entry for that date.' });
    res.json({ entry });
  });

  router.delete('/mood/:localDate', (req, res) => {
    const userId = currentUserId(req);
    const key = `${userId}:${req.params.localDate}`;
    if (!moodEntriesByUserDate.get(key)) return res.status(404).json({ error: 'No mood entry for that date.' });
    moodEntriesByUserDate.delete(key);
    res.json({ ok: true });
  });

  // =========================================================================
  // Journal
  // =========================================================================
  const journalSchema = z.object({
    type: z.enum(JOURNAL_ENTRY_TYPES),
    title: z.string().max(200).optional(),
    content: z.string().max(20000),
    tags: z.array(z.string().max(40)).max(10).optional(),
    isDraft: z.boolean().optional(),
  });

  router.get('/journal/prompts', (req, res) => {
    const tier = getUserTier(currentUserId(req));
    const prompts = tier === 'premium'
      ? JOURNAL_PROMPTS
      : JOURNAL_PROMPTS.filter((p) => JOURNAL_FREE_PROMPT_CATEGORIES.includes(p.type));
    res.json({ prompts, tier, fullLibrarySize: JOURNAL_PROMPTS.length });
  });

  router.post('/journal', (req, res) => {
    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const userId = currentUserId(req);
    const now = new Date().toISOString();
    const entry: JournalEntry = {
      id: uuid(),
      userId,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      tags: parsed.data.tags,
      favorite: false,
      isDraft: parsed.data.isDraft ?? false,
      lastSavedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    journalEntriesById.set(entry.id, entry);
    if (!entry.isDraft) recordWellnessEvent(userId, 'journal_entry_created', { type: entry.type });
    res.status(201).json({ entry });
  });

  function ownedJournalEntry(req: any, id: string): JournalEntry | undefined {
    const entry = journalEntriesById.get(id);
    if (!entry || entry.userId !== currentUserId(req) || entry.deletedAt) return undefined;
    return entry;
  }

  const journalUpdateSchema = journalSchema.partial().extend({ favorite: z.boolean().optional() });

  // Also serves as the autosave-draft endpoint: the frontend PUTs the same
  // entry id repeatedly with isDraft: true, updating lastSavedAt each time,
  // and finalizes by PUTting isDraft: false once.
  router.put('/journal/:id', (req, res) => {
    const entry = ownedJournalEntry(req, req.params.id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found.' });
    const parsed = journalUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const now = new Date().toISOString();
    const wasFavorited = !entry.favorite && parsed.data.favorite === true;
    Object.assign(entry, parsed.data, { lastSavedAt: now, updatedAt: now });
    journalEntriesById.set(entry.id, entry);
    if (wasFavorited) recordWellnessEvent(entry.userId, 'journal_entry_favorited', { type: entry.type });
    res.json({ entry });
  });

  router.delete('/journal/:id', (req, res) => {
    const entry = ownedJournalEntry(req, req.params.id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found.' });
    entry.deletedAt = new Date().toISOString();
    journalEntriesById.set(entry.id, entry);
    res.json({ ok: true });
  });

  router.get('/journal', (req, res) => {
    const userId = currentUserId(req);
    let entries = [...journalEntriesById.values()].filter((e) => e.userId === userId && !e.deletedAt && !e.isDraft);

    const { q, type, from, to, favoriteOnly } = req.query as Record<string, string | undefined>;
    if (q) {
      const needle = q.toLowerCase();
      entries = entries.filter((e) => e.content.toLowerCase().includes(needle) || e.title?.toLowerCase().includes(needle));
    }
    if (type) entries = entries.filter((e) => e.type === type);
    if (from) entries = entries.filter((e) => e.createdAt >= from);
    if (to) entries = entries.filter((e) => e.createdAt <= to);
    if (favoriteOnly === 'true') entries = entries.filter((e) => e.favorite);

    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ entries });
  });

  router.get('/journal/streak', (req, res) => {
    const userId = currentUserId(req);
    const entries = [...journalEntriesById.values()].filter((e) => e.userId === userId && !e.deletedAt && !e.isDraft);
    const daysWithEntry = new Set(entries.map((e) => e.createdAt.slice(0, 10)));

    if (daysWithEntry.size === 0) {
      return res.json({ hasData: false, currentStreak: 0, message: 'No journal entries yet - every entry counts, no pressure.' });
    }

    // Forgiving framing: count backward from today OR yesterday (a streak
    // "in progress" that hasn't been broken by today simply not having
    // happened yet is not treated as already broken).
    let streak = 0;
    let cursor = localDateToday();
    if (!daysWithEntry.has(cursor)) {
      cursor = addDaysToDateString(cursor, -1); // allow "yesterday" as the streak's current anchor
    }
    while (daysWithEntry.has(cursor)) {
      streak += 1;
      cursor = addDaysToDateString(cursor, -1);
    }
    res.json({ hasData: true, currentStreak: streak, totalDaysWithEntries: daysWithEntry.size });
  });

  // AI journal insight - CONSENT-GATED. consent must be explicitly true on
  // THIS request; it is never inferred from a prior tap or from the entry
  // existing. Journal text only ever reaches the AI provider through this
  // one call, with this one check in front of it.
  const journalAiSchema = z.object({
    entryId: z.string(),
    consent: z.literal(true),
    insightType: z.enum(['summary', 'reflective-questions', 'theme-identification', 'writing-suggestions']),
  });
  const journalAiDailyCountByUser = new Map<string, { date: string; count: number }>();

  router.post('/journal/ai-insight', async (req, res) => {
    const parsedBody = req.body ?? {};
    if (parsedBody.consent !== true) {
      return res.status(403).json({ error: 'AI journal insights require explicit per-request consent (consent: true). Refusing without it.' });
    }
    const parsed = journalAiSchema.safeParse(parsedBody);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const userId = currentUserId(req);
    const entry = ownedJournalEntry(req, parsed.data.entryId);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found.' });

    const tier = getUserTier(userId);
    if (tier !== 'premium') {
      const today = localDateToday();
      const rec = journalAiDailyCountByUser.get(userId);
      const countToday = rec && rec.date === today ? rec.count : 0;
      if (countToday >= FREE_JOURNAL_AI_DAILY_LIMIT) {
        return res.status(403).json({ error: `Free plan allows ${FREE_JOURNAL_AI_DAILY_LIMIT} AI journal insights per day. Upgrade for more.` });
      }
      journalAiDailyCountByUser.set(userId, { date: today, count: countToday + 1 });
    }

    const instructionByType: Record<string, string> = {
      summary: 'Write a short, warm 2-3 sentence summary of this journal entry.',
      'reflective-questions': 'Offer 2-3 gentle, open-ended reflective questions based on this journal entry.',
      'theme-identification': 'Identify 1-3 recurring themes or feelings present in this journal entry.',
      'writing-suggestions': 'Offer 1-2 gentle suggestions for what the user might explore writing about next.',
    };

    const reply = await aiProvider.complete([
      { role: 'system', content: 'You are a warm, nonjudgmental journaling assistant. Never diagnose. Keep replies short.' },
      { role: 'user', content: `${instructionByType[parsed.data.insightType]}\n\nEntry:\n${entry.content}` },
    ]);

    res.json({ insight: reply, insightType: parsed.data.insightType });
  });

  // =========================================================================
  // Breathing & Relaxation
  // =========================================================================
  router.get('/breathing/techniques', (req, res) => {
    const tier = getUserTier(currentUserId(req));
    const techniques = BREATHING_TECHNIQUE_CATALOGUE.map((t) => ({
      ...t,
      allowed: tier === 'premium' || isBreathingTechniqueAllowed(currentUserId(req), t.id),
    }));
    res.json({ techniques });
  });

  const breathingSchema = z.object({
    technique: z.enum(BREATHING_TECHNIQUES),
    plannedDurationSeconds: z.number().int().min(10).max(3600),
    actualDurationSeconds: z.number().int().min(0).max(3600),
    completed: z.boolean(),
  });

  router.post('/breathing/sessions', (req, res) => {
    const parsed = breathingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const userId = currentUserId(req);

    if (!isBreathingTechniqueAllowed(userId, parsed.data.technique)) {
      return res.status(403).json({ error: 'This breathing technique requires Solune Premium.' });
    }

    const session: BreathingSession = {
      id: uuid(),
      userId,
      technique: parsed.data.technique,
      plannedDurationSeconds: parsed.data.plannedDurationSeconds,
      // Recorded honestly: an abandoned session keeps completed:false and
      // its real actual duration, never silently discarded or upgraded.
      actualDurationSeconds: parsed.data.actualDurationSeconds,
      completed: parsed.data.completed,
      createdAt: new Date().toISOString(),
    };
    breathingSessionsById.set(session.id, session);
    recordWellnessEvent(userId, parsed.data.completed ? 'breathing_session_completed' : 'breathing_session_abandoned', {
      technique: session.technique, actualDurationSeconds: session.actualDurationSeconds,
    });
    res.status(201).json({ session });
  });

  router.get('/breathing/stats', (req, res) => {
    const userId = currentUserId(req);
    const sessions = [...breathingSessionsById.values()].filter((s) => s.userId === userId);
    if (sessions.length === 0) {
      return res.json({ hasData: false, totalSessions: 0, completedSessions: 0, totalMinutes: 0 });
    }
    const completed = sessions.filter((s) => s.completed);
    const totalSeconds = sessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0);
    res.json({
      hasData: true,
      totalSessions: sessions.length,
      completedSessions: completed.length,
      abandonedSessions: sessions.length - completed.length,
      totalMinutes: Math.round((totalSeconds / 60) * 10) / 10,
    });
  });

  // =========================================================================
  // Habits
  // =========================================================================
  router.get('/habits/predefined', (_req, res) => res.json({ habits: PREDEFINED_HABITS }));

  const habitCreateSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    frequency: z.enum(['daily', 'weekly', 'specific_days']),
    specificDays: z.array(z.number().int().min(0).max(6)).optional(),
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    target: z.string().max(100).optional(),
  });

  router.post('/habits', (req, res) => {
    const parsed = habitCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const userId = currentUserId(req);
    const activeCount = [...habitsById.values()].filter((h) => h.userId === userId && h.active).length;
    if (isHabitLimitReached(userId, activeCount)) {
      return res.status(403).json({ error: `Free plan allows ${MAX_FREE_HABITS} active habits. Upgrade for unlimited habits.` });
    }
    const habit: Habit = {
      id: uuid(),
      userId,
      name: parsed.data.name,
      description: parsed.data.description,
      frequency: parsed.data.frequency,
      specificDays: parsed.data.specificDays,
      reminderTime: parsed.data.reminderTime ?? null,
      target: parsed.data.target,
      active: true,
      createdAt: new Date().toISOString(),
    };
    habitsById.set(habit.id, habit);
    recordWellnessEvent(userId, 'habit_created', { frequency: habit.frequency });
    res.status(201).json({ habit });
  });

  function ownedHabit(req: any, id: string): Habit | undefined {
    const habit = habitsById.get(id);
    if (!habit || habit.userId !== currentUserId(req)) return undefined;
    return habit;
  }

  router.get('/habits', (req, res) => {
    const userId = currentUserId(req);
    const habits = [...habitsById.values()].filter((h) => h.userId === userId && h.active);
    res.json({ habits, maxFreeHabits: MAX_FREE_HABITS, tier: getUserTier(userId) });
  });

  router.put('/habits/:id', (req, res) => {
    const habit = ownedHabit(req, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    const parsed = habitCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    Object.assign(habit, parsed.data);
    habitsById.set(habit.id, habit);
    res.json({ habit });
  });

  router.delete('/habits/:id', (req, res) => {
    const habit = ownedHabit(req, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    habit.active = false;
    habit.archivedAt = new Date().toISOString();
    habitsById.set(habit.id, habit);
    res.json({ ok: true });
  });

  const habitCompleteSchema = z.object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

  router.post('/habits/:id/complete', (req, res) => {
    const habit = ownedHabit(req, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    const parsed = habitCompleteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const key = `${habit.id}:${parsed.data.localDate}`;
    if (habitCompletionsByKey.get(key)) return res.json({ ok: true, alreadyCompleted: true });
    habitCompletionsByKey.set(key, { habitId: habit.id, userId: habit.userId, localDate: parsed.data.localDate, completedAt: new Date().toISOString() });
    recordWellnessEvent(habit.userId, 'habit_completed', { habitId: habit.id });
    res.json({ ok: true });
  });

  router.delete('/habits/:id/complete/:localDate', (req, res) => {
    const habit = ownedHabit(req, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    habitCompletionsByKey.delete(`${habit.id}:${req.params.localDate}`);
    res.json({ ok: true });
  });

  // Current streak resets on a missed day; longest streak is a historical
  // high-water mark that a single missed day never retroactively lowers.
  router.get('/habits/:id/streak', (req, res) => {
    const habit = ownedHabit(req, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    const completedDates = new Set(
      [...habitCompletionsByKey.values()].filter((c) => c.habitId === habit.id).map((c) => c.localDate),
    );
    if (completedDates.size === 0) {
      return res.json({ hasData: false, currentStreak: 0, longestStreak: 0 });
    }
    const sorted = [...completedDates].sort();
    let longest = 0, run = 0, prev: string | null = null;
    for (const d of sorted) {
      if (prev) {
        const gapDays = Math.round((new Date(d).getTime() - new Date(prev).getTime()) / 86400000);
        run = gapDays === 1 ? run + 1 : 1;
      } else run = 1;
      longest = Math.max(longest, run);
      prev = d;
    }
    // Current streak: count back from today/yesterday, same forgiving anchor as journal streak.
    let current = 0;
    let cursor = localDateToday();
    if (!completedDates.has(cursor)) cursor = addDaysToDateString(cursor, -1);
    while (completedDates.has(cursor)) {
      current += 1;
      cursor = addDaysToDateString(cursor, -1);
    }
    res.json({ hasData: true, currentStreak: current, longestStreak: longest });
  });

  router.get('/habits/:id/weekly-completion', (req, res) => {
    const habit = ownedHabit(req, req.params.id);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    const cutoff = Date.now() - 7 * 86400000;
    const completions = [...habitCompletionsByKey.values()].filter(
      (c) => c.habitId === habit.id && new Date(c.localDate).getTime() >= cutoff,
    );
    res.json({ completedDays: completions.length, percentage: Math.round((completions.length / 7) * 100) });
  });

  // =========================================================================
  // Challenges
  // =========================================================================
  router.get('/challenges', (req, res) => {
    const userId = currentUserId(req);
    const challenges = CHALLENGES.map((c) => ({
      id: c.id, title: c.title, description: c.description, durationDays: c.durationDays,
      contentDepth: c.contentDepth, premium: c.premium, allowed: isChallengeAllowed(userId, c.id),
    }));
    res.json({ challenges });
  });

  router.get('/challenges/:id', (req, res) => {
    const def = findChallengeDefinition(req.params.id);
    if (!def) return res.status(404).json({ error: 'Challenge not found.' });
    res.json({ challenge: def, allowed: isChallengeAllowed(currentUserId(req), def.id) });
  });

  router.post('/challenges/:id/join', (req, res) => {
    const userId = currentUserId(req);
    const def = findChallengeDefinition(req.params.id);
    if (!def) return res.status(404).json({ error: 'Challenge not found.' });
    if (!isChallengeAllowed(userId, def.id)) return res.status(403).json({ error: 'This challenge requires Solune Premium.' });

    const key = `${userId}:${def.id}`;
    const existing = challengeProgressByKey.get(key);
    if (existing && existing.status === 'active') {
      return res.json({ progress: existing, alreadyJoined: true });
    }
    const progress: ChallengeProgress = {
      userId, challengeId: def.id, joinedAt: new Date().toISOString(),
      currentDay: 1, completedDays: [], status: 'active', restartedAt: null, lastCompletedAt: null,
    };
    challengeProgressByKey.set(key, progress);
    recordWellnessEvent(userId, 'challenge_joined', { challengeId: def.id });
    res.status(201).json({ progress });
  });

  router.post('/challenges/:id/complete-day', (req, res) => {
    const userId = currentUserId(req);
    const def = findChallengeDefinition(req.params.id);
    if (!def) return res.status(404).json({ error: 'Challenge not found.' });
    const key = `${userId}:${def.id}`;
    const progress = challengeProgressByKey.get(key);
    if (!progress || progress.status !== 'active') return res.status(400).json({ error: 'Not an active participant in this challenge.' });

    const day = Number(req.body?.day);
    if (!Number.isInteger(day) || day < 1 || day > def.durationDays) return res.status(400).json({ error: 'Invalid day.' });
    if (!progress.completedDays.includes(day)) progress.completedDays.push(day);
    progress.currentDay = Math.min(def.durationDays, Math.max(progress.currentDay, day + 1));
    progress.lastCompletedAt = new Date().toISOString();
    if (progress.completedDays.length >= def.durationDays) {
      progress.status = 'completed';
      recordWellnessEvent(userId, 'challenge_completed', { challengeId: def.id });
    }
    challengeProgressByKey.set(key, progress);
    res.json({ progress });
  });

  router.post('/challenges/:id/leave', (req, res) => {
    const userId = currentUserId(req);
    const key = `${userId}:${req.params.id}`;
    const progress = challengeProgressByKey.get(key);
    if (!progress) return res.status(404).json({ error: 'Not a participant in this challenge.' });
    progress.status = 'abandoned';
    challengeProgressByKey.set(key, progress);
    res.json({ progress });
  });

  // Explicit, confirmed restart only - req.body.confirm must be exactly true,
  // never implicit, so a user's prior progress is never wiped by accident.
  router.post('/challenges/:id/restart', (req, res) => {
    const userId = currentUserId(req);
    const def = findChallengeDefinition(req.params.id);
    if (!def) return res.status(404).json({ error: 'Challenge not found.' });
    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Restarting wipes prior progress on this challenge - resend with confirm: true to proceed.' });
    }
    const key = `${userId}:${def.id}`;
    const progress: ChallengeProgress = {
      userId, challengeId: def.id, joinedAt: new Date().toISOString(),
      currentDay: 1, completedDays: [], status: 'active',
      restartedAt: new Date().toISOString(), lastCompletedAt: null,
    };
    challengeProgressByKey.set(key, progress);
    recordWellnessEvent(userId, 'challenge_restarted', { challengeId: def.id });
    res.json({ progress });
  });

  router.get('/challenges/progress/mine', (req, res) => {
    const userId = currentUserId(req);
    const progress = [...challengeProgressByKey.values()].filter((p) => p.userId === userId);
    res.json({ progress });
  });

  // =========================================================================
  // Meditation & Sleep (real catalogue/session infra, no real audio assets)
  // =========================================================================
  router.get('/meditation/catalogue', (req, res) => {
    const { category } = req.query as { category?: string };
    let items = MEDITATION_CATALOGUE;
    if (category) items = items.filter((m) => m.category === category);
    res.json({ items });
  });

  const meditationStartSchema = z.object({ contentId: z.string() });
  router.post('/meditation/sessions', (req, res) => {
    const parsed = meditationStartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const content = findMeditationContent(parsed.data.contentId);
    if (!content) return res.status(404).json({ error: 'Content not found.' });
    const userId = currentUserId(req);
    if (content.premium && getUserTier(userId) !== 'premium') {
      return res.status(403).json({ error: 'This content requires Solune Premium.' });
    }
    const session = {
      id: uuid(), userId, contentId: content.id, startedAt: new Date().toISOString(),
      progressSeconds: 0, completed: false, updatedAt: new Date().toISOString(),
    };
    meditationSessionsById.set(session.id, session);
    recordWellnessEvent(userId, 'meditation_session_started', { contentId: content.id, category: content.category });
    res.status(201).json({ session, assetStatus: content.assetStatus, audioUrl: content.audioUrl });
  });

  const meditationProgressSchema = z.object({ progressSeconds: z.number().int().min(0), completed: z.boolean().optional() });
  router.put('/meditation/sessions/:id', (req, res) => {
    const userId = currentUserId(req);
    const session = meditationSessionsById.get(req.params.id);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found.' });
    const parsed = meditationProgressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    session.progressSeconds = parsed.data.progressSeconds;
    const justCompleted = !session.completed && parsed.data.completed === true;
    if (parsed.data.completed !== undefined) session.completed = parsed.data.completed;
    session.updatedAt = new Date().toISOString();
    meditationSessionsById.set(session.id, session);
    if (justCompleted) recordWellnessEvent(userId, 'meditation_session_completed', { contentId: session.contentId });
    res.json({ session });
  });

  router.get('/meditation/recent', (req, res) => {
    const userId = currentUserId(req);
    const sessions = [...meditationSessionsById.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 10);
    res.json({ sessions });
  });

  router.post('/meditation/favorites/:contentId', (req, res) => {
    const userId = currentUserId(req);
    const favs = wellnessFavoritesByUser.get(userId) ?? { userId, meditationIds: [], inspirationIds: [] };
    if (!favs.meditationIds.includes(req.params.contentId)) favs.meditationIds.push(req.params.contentId);
    wellnessFavoritesByUser.set(userId, favs);
    res.json({ favorites: favs });
  });

  router.delete('/meditation/favorites/:contentId', (req, res) => {
    const userId = currentUserId(req);
    const favs = wellnessFavoritesByUser.get(userId) ?? { userId, meditationIds: [], inspirationIds: [] };
    favs.meditationIds = favs.meditationIds.filter((id) => id !== req.params.contentId);
    wellnessFavoritesByUser.set(userId, favs);
    res.json({ favorites: favs });
  });

  // =========================================================================
  // Personal Wellness Goals
  // =========================================================================
  const goalSchema = z.object({
    category: z.enum(WELLNESS_GOAL_CATEGORIES),
    title: z.string().min(1).max(150),
    description: z.string().max(1000).optional(),
    targetFrequency: z.string().max(100).optional(),
    targetDuration: z.string().max(100).optional(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  });

  router.post('/goals', (req, res) => {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const userId = currentUserId(req);
    const goal: WellnessGoal = {
      id: uuid(), userId, ...parsed.data, deadline: parsed.data.deadline ?? null,
      status: 'active', progress: [], createdAt: new Date().toISOString(),
    };
    wellnessGoalsById.set(goal.id, goal);
    recordWellnessEvent(userId, 'goal_created', { category: goal.category });
    res.status(201).json({ goal });
  });

  function ownedGoal(req: any, id: string): WellnessGoal | undefined {
    const goal = wellnessGoalsById.get(id);
    if (!goal || goal.userId !== currentUserId(req)) return undefined;
    return goal;
  }

  router.get('/goals', (req, res) => {
    const userId = currentUserId(req);
    const { status } = req.query as { status?: string };
    let goals = [...wellnessGoalsById.values()].filter((g) => g.userId === userId);
    if (status) goals = goals.filter((g) => g.status === status);
    res.json({ goals });
  });

  router.put('/goals/:id', (req, res) => {
    const goal = ownedGoal(req, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });
    const parsed = goalSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    Object.assign(goal, parsed.data);
    wellnessGoalsById.set(goal.id, goal);
    res.json({ goal });
  });

  router.post('/goals/:id/progress', (req, res) => {
    const goal = ownedGoal(req, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : undefined;
    goal.progress.push({ localDate: localDateToday(), note, userReported: true, createdAt: new Date().toISOString() });
    wellnessGoalsById.set(goal.id, goal);
    res.json({ goal });
  });

  router.post('/goals/:id/complete', (req, res) => {
    const goal = ownedGoal(req, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });
    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
    wellnessGoalsById.set(goal.id, goal);
    recordWellnessEvent(goal.userId, 'goal_completed', { category: goal.category });
    res.json({ goal });
  });

  router.delete('/goals/:id', (req, res) => {
    const goal = ownedGoal(req, req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });
    goal.status = 'abandoned';
    wellnessGoalsById.set(goal.id, goal);
    res.json({ ok: true });
  });

  // =========================================================================
  // Daily Inspiration
  // =========================================================================
  router.get('/inspiration/today', (req, res) => {
    const userId = currentUserId(req);
    const today = localDateToday();
    let history = inspirationHistoryByUser.get(userId) ?? { userId, shown: [], todayContentId: null, todayLocalDate: null };

    if (history.todayLocalDate === today && history.todayContentId) {
      const content = INSPIRATION_LIBRARY.find((i) => i.id === history.todayContentId);
      return res.json({ content });
    }

    const lookbackCutoff = Date.now() - INSPIRATION_NO_REPEAT_DAYS * 86400000;
    const recentlyShownIds = new Set(
      history.shown.filter((s) => new Date(s.localDate).getTime() >= lookbackCutoff).map((s) => s.contentId),
    );
    const pool = INSPIRATION_LIBRARY.filter((i) => !i.astrologyFlavored && !recentlyShownIds.has(i.id));
    const choices = pool.length > 0 ? pool : INSPIRATION_LIBRARY.filter((i) => !i.astrologyFlavored);
    const picked = choices[Math.floor(Math.random() * choices.length)];

    history = {
      userId,
      shown: [...history.shown, { contentId: picked.id, localDate: today }].slice(-200),
      todayContentId: picked.id,
      todayLocalDate: today,
    };
    inspirationHistoryByUser.set(userId, history);
    res.json({ content: picked });
  });

  router.get('/inspiration/astrology-flavored', (_req, res) => {
    res.json({ items: INSPIRATION_LIBRARY.filter((i) => i.astrologyFlavored) });
  });

  // Full-library browse, mirroring the meditation/catalogue listing pattern -
  // added so the app can offer a real "browse by category" experience beyond
  // just today's single idempotent pick. Read-only, no new state.
  router.get('/inspiration/library', (req, res) => {
    const { type } = req.query as { type?: string };
    let items = INSPIRATION_LIBRARY;
    if (type) items = items.filter((i) => i.type === type);
    res.json({ items });
  });

  router.post('/inspiration/favorites/:contentId', (req, res) => {
    const userId = currentUserId(req);
    if (!INSPIRATION_LIBRARY.find((i) => i.id === req.params.contentId)) return res.status(404).json({ error: 'Content not found.' });
    const favs = wellnessFavoritesByUser.get(userId) ?? { userId, meditationIds: [], inspirationIds: [] };
    if (!favs.inspirationIds.includes(req.params.contentId)) favs.inspirationIds.push(req.params.contentId);
    wellnessFavoritesByUser.set(userId, favs);
    recordWellnessEvent(userId, 'inspiration_favorited', { contentId: req.params.contentId });
    res.json({ favorites: favs });
  });

  router.get('/inspiration/favorites', (req, res) => {
    const userId = currentUserId(req);
    const favs = wellnessFavoritesByUser.get(userId) ?? { userId, meditationIds: [], inspirationIds: [] };
    const items = INSPIRATION_LIBRARY.filter((i) => favs.inspirationIds.includes(i.id));
    res.json({ items });
  });

  // =========================================================================
  // Notification preferences (STORAGE only - local scheduling is the app's job)
  // =========================================================================
  router.get('/preferences', (req, res) => {
    const userId = currentUserId(req);
    const prefs = wellnessPreferencesByUser.get(userId) ?? {
      userId, moodReminderEnabled: false, moodReminderTime: '20:00',
      habitReminderEnabled: false, habitReminderTime: '09:00',
      journalReminderEnabled: false, journalReminderTime: '21:00',
      meditationReminderEnabled: false, meditationReminderTime: '07:30',
      quietHoursStart: null, quietHoursEnd: null, updatedAt: new Date().toISOString(),
    };
    res.json(prefs);
  });

  router.put('/preferences', (req, res) => {
    const userId = currentUserId(req);
    const b = req.body ?? {};
    const prefs = {
      userId,
      moodReminderEnabled: Boolean(b.moodReminderEnabled),
      moodReminderTime: b.moodReminderTime ?? '20:00',
      habitReminderEnabled: Boolean(b.habitReminderEnabled),
      habitReminderTime: b.habitReminderTime ?? '09:00',
      journalReminderEnabled: Boolean(b.journalReminderEnabled),
      journalReminderTime: b.journalReminderTime ?? '21:00',
      meditationReminderEnabled: Boolean(b.meditationReminderEnabled),
      meditationReminderTime: b.meditationReminderTime ?? '07:30',
      quietHoursStart: b.quietHoursStart ?? null,
      quietHoursEnd: b.quietHoursEnd ?? null,
      updatedAt: new Date().toISOString(),
    };
    wellnessPreferencesByUser.set(userId, prefs);
    res.json(prefs);
  });

  // =========================================================================
  // Analytics (generic write path, mirrors recordCompletedReading precedent)
  // =========================================================================
  const analyticsSchema = z.object({
    type: z.string(),
    data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  });
  router.post('/analytics/event', (req, res) => {
    const parsed = analyticsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    recordWellnessEvent(currentUserId(req), parsed.data.type as any, (parsed.data.data ?? {}) as Record<string, string | number | boolean>);
    res.json({ ok: true });
  });

  // =========================================================================
  // AI Wellness Companion - reuses crisisDetection, modeClassifier, aiProvider.
  // Context retrieval is minimal-per-request: mood/habit/meditation/goal
  // SUMMARIES only, never raw journal text (see buildWellnessContext below).
  // =========================================================================
  const aiCompanionDailyCountByUser = new Map<string, { date: string; count: number }>();

  function buildWellnessContext(userId: string): string {
    const parts: string[] = [];
    const moods = [...moodEntriesByUserDate.values()].filter((e) => e.userId === userId).slice(-7);
    if (moods.length > 0) {
      parts.push(`Recent mood check-ins (last ${moods.length}): ${moods.map((m) => m.mood).join(', ')}.`);
    }
    const habits = [...habitsById.values()].filter((h) => h.userId === userId && h.active);
    if (habits.length > 0) parts.push(`Active habits: ${habits.map((h) => h.name).join(', ')}.`);
    const challenges = [...challengeProgressByKey.values()].filter((c) => c.userId === userId && c.status === 'active');
    if (challenges.length > 0) parts.push(`Active challenges: ${challenges.map((c) => `${c.challengeId} (day ${c.currentDay})`).join(', ')}.`);
    const goals = [...wellnessGoalsById.values()].filter((g) => g.userId === userId && g.status === 'active');
    if (goals.length > 0) parts.push(`Active goals: ${goals.map((g) => g.title).join(', ')}.`);
    const meditations = [...meditationSessionsById.values()].filter((m) => m.userId === userId).slice(-5);
    if (meditations.length > 0) parts.push(`Recently played meditation/sleep content ids: ${meditations.map((m) => m.contentId).join(', ')}.`);
    return parts.length > 0 ? `Context about this user (summaries only, never raw journal text):\n${parts.join('\n')}` : '';
  }

  const aiMessageSchema = z.object({
    conversationId: z.string().nullable(),
    message: z.string().min(1).max(2000),
    // Explicit opt-in to include ONE specific journal entry's content for
    // this one request - never implicit, never automatic, never persisted
    // into analytics or logs.
    includeJournalEntryId: z.string().optional(),
    journalConsent: z.boolean().optional(),
  });

  router.post('/ai-companion/message', async (req, res) => {
    const parsed = aiMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const userId = currentUserId(req);
    const { message } = parsed.data;

    const tier = getUserTier(userId);
    const dailyLimit = tier === 'premium' ? PREMIUM_AI_COMPANION_DAILY_MESSAGES : FREE_AI_COMPANION_DAILY_MESSAGES;
    const today = localDateToday();
    const rec = aiCompanionDailyCountByUser.get(userId);
    const countToday = rec && rec.date === today ? rec.count : 0;
    if (countToday >= dailyLimit) {
      return res.status(403).json({ error: `Daily AI companion message limit (${dailyLimit}) reached. ${tier === 'premium' ? 'Try again tomorrow.' : 'Upgrade for a higher daily limit.'}` });
    }

    let conversationId = parsed.data.conversationId;
    let conversation = conversationId ? wellnessAiConversationsById.get(conversationId) : undefined;
    if (!conversation || conversation.userId !== userId) {
      conversationId = uuid();
      conversation = { id: conversationId, userId, messages: [], createdAt: new Date().toISOString() };
    }
    conversation.messages.push({ role: 'user', content: message });

    // Crisis check runs on every incoming message before any normal
    // processing, same as every other AI route in this app.
    if (containsCrisisLanguage(message)) {
      conversation.messages.push({ role: 'assistant', content: CRISIS_RESPONSE });
      wellnessAiConversationsById.set(conversationId!, conversation);
      recordWellnessEvent(userId, 'ai_companion_crisis_detected', {});
      return res.json({ conversationId, reply: CRISIS_RESPONSE, crisisFlag: true });
    }

    let journalExcerpt = '';
    if (parsed.data.includeJournalEntryId && parsed.data.journalConsent === true) {
      const entry = ownedJournalEntry(req, parsed.data.includeJournalEntryId);
      if (entry) journalExcerpt = `\n\nThe user explicitly consented to share this specific journal entry for this request:\n${entry.content}`;
    }

    const context = buildWellnessContext(userId);
    const mode = classifyMode(message, false);
    const options = generationOptionsForMode(mode);

    const reply = await aiProvider.complete([
      { role: 'system', content: `${WELLNESS_SYSTEM_PROMPT}\n\n${context}${journalExcerpt}` },
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
    ], options);

    conversation.messages.push({ role: 'assistant', content: reply });
    wellnessAiConversationsById.set(conversationId!, conversation);
    aiCompanionDailyCountByUser.set(userId, { date: today, count: countToday + 1 });
    recordWellnessEvent(userId, 'ai_companion_message_sent', { mode });

    res.json({ conversationId, reply, mode, remainingToday: Math.max(0, dailyLimit - countToday - 1) });
  });

  return router;
}
