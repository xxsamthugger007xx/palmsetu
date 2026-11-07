/**
 * Wellness module API client. Follows the exact request()-wrapper pattern
 * used by astrologyApi.ts/palmApi.ts (apiRequest.ts handles network-error
 * detection, 4xx/5xx parsing, etc - never reinvented here).
 *
 * Types mirror server/src/types/wellness.ts exactly - that file is the
 * source of truth, these are a frontend-local copy kept in sync by hand.
 */
import { request } from './apiRequest';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type MoodLevel = 'great' | 'good' | 'okay' | 'down' | 'low';
export const EMOTION_OPTIONS = [
  'happy', 'calm', 'excited', 'grateful', 'motivated', 'relaxed', 'anxious', 'stressed',
  'sad', 'lonely', 'frustrated', 'tired', 'overwhelmed', 'confident', 'hopeful',
] as const;
export type Emotion = typeof EMOTION_OPTIONS[number];

export interface MoodEntry {
  id: string;
  userId: string;
  localDate: string;
  mood: MoodLevel;
  emotions: Emotion[];
  energy: number;
  stress: number;
  sleepQuality: number;
  note?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export const JOURNAL_ENTRY_TYPES = [
  'daily', 'gratitude', 'free-writing', 'guided-reflection', 'emotional-reflection',
  'achievement', 'relationship-reflection', 'personal-growth',
] as const;
export type JournalEntryType = typeof JOURNAL_ENTRY_TYPES[number];

export interface JournalEntry {
  id: string;
  userId: string;
  type: JournalEntryType;
  title?: string;
  content: string;
  tags?: string[];
  favorite: boolean;
  isDraft: boolean;
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export const BREATHING_TECHNIQUES = ['box', '4-7-8', 'deep', 'relaxation', 'focus', 'short-mindfulness'] as const;
export type BreathingTechnique = typeof BREATHING_TECHNIQUES[number];

/** Free techniques per server/src/wellness/entitlements.ts
 * (FREE_BREATHING_TECHNIQUES) - duplicated here only for local lock-badge
 * display; the server's `allowed` flag on each catalogue entry is always
 * the real source of truth for whether a session POST will succeed. */
export const FREE_BREATHING_TECHNIQUES: BreathingTechnique[] = ['box', 'deep'];

export interface BreathingTechniqueCatalogueEntry {
  id: BreathingTechnique;
  name: string;
  description: string;
  phases: { label: string; seconds: number }[];
  defaultCycles: number;
  allowed: boolean;
}

export interface BreathingSession {
  id: string;
  userId: string;
  technique: BreathingTechnique;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  completed: boolean;
  createdAt: string;
}

export type HabitFrequency = 'daily' | 'weekly' | 'specific_days';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  specificDays?: number[];
  reminderTime?: string | null;
  target?: string;
  active: boolean;
  createdAt: string;
  archivedAt?: string | null;
}

export interface PredefinedHabit {
  id: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  category: string;
}

export type ChallengeDuration = 7 | 21;

export interface ChallengeTask {
  day: number;
  title: string;
  description: string;
}

export interface ChallengeSummary {
  id: string;
  title: string;
  description: string;
  durationDays: ChallengeDuration;
  contentDepth: 'full' | 'weekly_theme';
  premium: boolean;
  allowed: boolean;
}

export interface ChallengeDefinition extends ChallengeSummary {
  tasks: ChallengeTask[];
}

export type ChallengeStatus = 'active' | 'completed' | 'abandoned';

export interface ChallengeProgress {
  userId: string;
  challengeId: string;
  joinedAt: string;
  currentDay: number;
  completedDays: number[];
  status: ChallengeStatus;
  restartedAt?: string | null;
  lastCompletedAt?: string | null;
}

export type MeditationCategory =
  | 'morning' | 'sleep' | 'stress-relief' | 'focus' | 'mindfulness' | 'confidence'
  | 'gratitude' | 'relaxation' | 'body-awareness' | 'emotional-reset' | 'sleep-sounds';

export type AssetStatus = 'available' | 'awaiting_upload';

export interface MeditationContent {
  id: string;
  category: MeditationCategory;
  title: string;
  description: string;
  durationMinutes: number;
  audioUrl: string | null;
  assetStatus: AssetStatus;
  premium: boolean;
}

export interface MeditationSession {
  id: string;
  userId: string;
  contentId: string;
  startedAt: string;
  progressSeconds: number;
  completed: boolean;
  updatedAt: string;
}

export const WELLNESS_GOAL_CATEGORIES = [
  'sleep', 'exercise', 'nutrition', 'mindfulness', 'screen-time', 'social-connection',
  'gratitude-practice', 'stress-management', 'personal-growth', 'water-intake',
] as const;
export type WellnessGoalCategory = typeof WELLNESS_GOAL_CATEGORIES[number];

export interface WellnessGoalProgressNote {
  localDate: string;
  note?: string;
  userReported: true;
  createdAt: string;
}

export type WellnessGoalStatus = 'active' | 'completed' | 'abandoned';

export interface WellnessGoal {
  id: string;
  userId: string;
  category: WellnessGoalCategory;
  title: string;
  description?: string;
  targetFrequency?: string;
  targetDuration?: string;
  deadline?: string | null;
  status: WellnessGoalStatus;
  progress: WellnessGoalProgressNote[];
  createdAt: string;
  completedAt?: string | null;
}

export type InspirationType =
  | 'affirmation' | 'gratitude-prompt' | 'motivational-thought' | 'reflection-question'
  | 'positive-reminder' | 'confidence-prompt' | 'growth-message';

export interface InspirationContent {
  id: string;
  type: InspirationType;
  text: string;
  astrologyFlavored: boolean;
}

export interface WellnessNotificationPreferences {
  userId: string;
  moodReminderEnabled: boolean;
  moodReminderTime: string;
  habitReminderEnabled: boolean;
  habitReminderTime: string;
  journalReminderEnabled: boolean;
  journalReminderTime: string;
  meditationReminderEnabled: boolean;
  meditationReminderTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string;
}

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const wellnessApi = {
  todayLocalDate,

  // Mood
  saveMood: (payload: { localDate: string; mood: MoodLevel; emotions?: Emotion[]; energy: number; stress: number; sleepQuality: number; note?: string; tags?: string[] }) =>
    request<{ entry: MoodEntry; wasUpdate: boolean }>(BASE_URL, '/wellness/mood', { method: 'POST', body: JSON.stringify(payload) }),
  getMoodHistory: () =>
    request<{ entries: MoodEntry[]; freeHistoryWindowDays: number | null; totalEntriesStored: number }>(BASE_URL, '/wellness/mood/history'),
  getMoodTrends: (window: 'week' | 'month' = 'week') =>
    request<{
      hasData: boolean; windowDays: number; checkInCount: number;
      moodDistribution: Record<string, number>; emotionFrequency: Record<string, number>;
      averageEnergy: number | null; averageStress: number | null; averageSleepQuality: number | null; message?: string;
    }>(BASE_URL, `/wellness/mood/trends?window=${window}`),
  getMoodForDate: (localDate: string) =>
    request<{ entry: MoodEntry }>(BASE_URL, `/wellness/mood/${localDate}`),
  deleteMoodForDate: (localDate: string) =>
    request<{ ok: true }>(BASE_URL, `/wellness/mood/${localDate}`, { method: 'DELETE' }),

  // Journal
  getJournalPrompts: () =>
    request<{ prompts: { type: JournalEntryType; text: string }[]; tier: 'free' | 'premium'; fullLibrarySize: number }>(BASE_URL, '/wellness/journal/prompts'),
  createJournalEntry: (payload: { type: JournalEntryType; title?: string; content: string; tags?: string[]; isDraft?: boolean }) =>
    request<{ entry: JournalEntry }>(BASE_URL, '/wellness/journal', { method: 'POST', body: JSON.stringify(payload) }),
  updateJournalEntry: (id: string, payload: Partial<{ type: JournalEntryType; title?: string; content: string; tags?: string[]; isDraft?: boolean; favorite?: boolean }>) =>
    request<{ entry: JournalEntry }>(BASE_URL, `/wellness/journal/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteJournalEntry: (id: string) =>
    request<{ ok: true }>(BASE_URL, `/wellness/journal/${id}`, { method: 'DELETE' }),
  listJournalEntries: (params?: { q?: string; type?: JournalEntryType; from?: string; to?: string; favoriteOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.type) qs.set('type', params.type);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.favoriteOnly) qs.set('favoriteOnly', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ entries: JournalEntry[] }>(BASE_URL, `/wellness/journal${suffix}`);
  },
  getJournalStreak: () =>
    request<{ hasData: boolean; currentStreak: number; totalDaysWithEntries?: number; message?: string }>(BASE_URL, '/wellness/journal/streak'),
  // Consent-gated: callers MUST only invoke this after the user explicitly
  // opts in via a visible consent control - never call with consent defaulted.
  getJournalAiInsight: (payload: { entryId: string; consent: true; insightType: 'summary' | 'reflective-questions' | 'theme-identification' | 'writing-suggestions' }) =>
    request<{ insight: string; insightType: string }>(BASE_URL, '/wellness/journal/ai-insight', { method: 'POST', body: JSON.stringify(payload) }),

  // Breathing
  getBreathingTechniques: () =>
    request<{ techniques: BreathingTechniqueCatalogueEntry[] }>(BASE_URL, '/wellness/breathing/techniques'),
  saveBreathingSession: (payload: { technique: BreathingTechnique; plannedDurationSeconds: number; actualDurationSeconds: number; completed: boolean }) =>
    request<{ session: BreathingSession }>(BASE_URL, '/wellness/breathing/sessions', { method: 'POST', body: JSON.stringify(payload) }),
  getBreathingStats: () =>
    request<{ hasData: boolean; totalSessions: number; completedSessions: number; abandonedSessions?: number; totalMinutes: number }>(BASE_URL, '/wellness/breathing/stats'),

  // Habits
  getPredefinedHabits: () =>
    request<{ habits: PredefinedHabit[] }>(BASE_URL, '/wellness/habits/predefined'),
  createHabit: (payload: { name: string; description?: string; frequency: HabitFrequency; specificDays?: number[]; reminderTime?: string | null; target?: string }) =>
    request<{ habit: Habit }>(BASE_URL, '/wellness/habits', { method: 'POST', body: JSON.stringify(payload) }),
  getHabits: () =>
    request<{ habits: Habit[]; maxFreeHabits: number; tier: 'free' | 'premium' }>(BASE_URL, '/wellness/habits'),
  updateHabit: (id: string, payload: Partial<{ name: string; description?: string; frequency: HabitFrequency; specificDays?: number[]; reminderTime?: string | null; target?: string }>) =>
    request<{ habit: Habit }>(BASE_URL, `/wellness/habits/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteHabit: (id: string) =>
    request<{ ok: true }>(BASE_URL, `/wellness/habits/${id}`, { method: 'DELETE' }),
  completeHabit: (id: string, localDate: string) =>
    request<{ ok: true; alreadyCompleted?: boolean }>(BASE_URL, `/wellness/habits/${id}/complete`, { method: 'POST', body: JSON.stringify({ localDate }) }),
  uncompleteHabit: (id: string, localDate: string) =>
    request<{ ok: true }>(BASE_URL, `/wellness/habits/${id}/complete/${localDate}`, { method: 'DELETE' }),
  getHabitStreak: (id: string) =>
    request<{ hasData: boolean; currentStreak: number; longestStreak: number }>(BASE_URL, `/wellness/habits/${id}/streak`),
  getHabitWeeklyCompletion: (id: string) =>
    request<{ completedDays: number; percentage: number }>(BASE_URL, `/wellness/habits/${id}/weekly-completion`),

  // Challenges
  getChallenges: () =>
    request<{ challenges: ChallengeSummary[] }>(BASE_URL, '/wellness/challenges'),
  getChallenge: (id: string) =>
    request<{ challenge: ChallengeDefinition; allowed: boolean }>(BASE_URL, `/wellness/challenges/${id}`),
  joinChallenge: (id: string) =>
    request<{ progress: ChallengeProgress; alreadyJoined?: boolean }>(BASE_URL, `/wellness/challenges/${id}/join`, { method: 'POST' }),
  leaveChallenge: (id: string) =>
    request<{ progress: ChallengeProgress }>(BASE_URL, `/wellness/challenges/${id}/leave`, { method: 'POST' }),
  restartChallenge: (id: string) =>
    request<{ progress: ChallengeProgress }>(BASE_URL, `/wellness/challenges/${id}/restart`, { method: 'POST', body: JSON.stringify({ confirm: true }) }),
  completeChallengeDay: (id: string, day: number) =>
    request<{ progress: ChallengeProgress }>(BASE_URL, `/wellness/challenges/${id}/complete-day`, { method: 'POST', body: JSON.stringify({ day }) }),
  getMyChallengeProgress: () =>
    request<{ progress: ChallengeProgress[] }>(BASE_URL, '/wellness/challenges/progress/mine'),

  // Meditation
  getMeditationCatalogue: (category?: MeditationCategory) =>
    request<{ items: MeditationContent[] }>(BASE_URL, `/wellness/meditation/catalogue${category ? `?category=${category}` : ''}`),
  startMeditationSession: (contentId: string) =>
    request<{ session: MeditationSession; assetStatus: AssetStatus; audioUrl: string | null }>(BASE_URL, '/wellness/meditation/sessions', { method: 'POST', body: JSON.stringify({ contentId }) }),
  updateMeditationSession: (id: string, payload: { progressSeconds: number; completed?: boolean }) =>
    request<{ session: MeditationSession }>(BASE_URL, `/wellness/meditation/sessions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getRecentMeditation: () =>
    request<{ sessions: MeditationSession[] }>(BASE_URL, '/wellness/meditation/recent'),
  favoriteMeditation: (contentId: string) =>
    request<{ favorites: { meditationIds: string[]; inspirationIds: string[] } }>(BASE_URL, `/wellness/meditation/favorites/${contentId}`, { method: 'POST' }),
  unfavoriteMeditation: (contentId: string) =>
    request<{ favorites: { meditationIds: string[]; inspirationIds: string[] } }>(BASE_URL, `/wellness/meditation/favorites/${contentId}`, { method: 'DELETE' }),

  // Goals
  createGoal: (payload: { category: WellnessGoalCategory; title: string; description?: string; targetFrequency?: string; targetDuration?: string; deadline?: string | null }) =>
    request<{ goal: WellnessGoal }>(BASE_URL, '/wellness/goals', { method: 'POST', body: JSON.stringify(payload) }),
  getGoals: (status?: WellnessGoalStatus) =>
    request<{ goals: WellnessGoal[] }>(BASE_URL, `/wellness/goals${status ? `?status=${status}` : ''}`),
  updateGoal: (id: string, payload: Partial<{ category: WellnessGoalCategory; title: string; description?: string; targetFrequency?: string; targetDuration?: string; deadline?: string | null }>) =>
    request<{ goal: WellnessGoal }>(BASE_URL, `/wellness/goals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  addGoalProgress: (id: string, note?: string) =>
    request<{ goal: WellnessGoal }>(BASE_URL, `/wellness/goals/${id}/progress`, { method: 'POST', body: JSON.stringify({ note }) }),
  completeGoal: (id: string) =>
    request<{ goal: WellnessGoal }>(BASE_URL, `/wellness/goals/${id}/complete`, { method: 'POST' }),
  deleteGoal: (id: string) =>
    request<{ ok: true }>(BASE_URL, `/wellness/goals/${id}`, { method: 'DELETE' }),

  // Inspiration
  getTodayInspiration: () =>
    request<{ content: InspirationContent }>(BASE_URL, '/wellness/inspiration/today'),
  getAstrologyFlavoredInspiration: () =>
    request<{ items: InspirationContent[] }>(BASE_URL, '/wellness/inspiration/astrology-flavored'),
  getInspirationLibrary: (type?: InspirationType) =>
    request<{ items: InspirationContent[] }>(BASE_URL, `/wellness/inspiration/library${type ? `?type=${type}` : ''}`),
  favoriteInspiration: (contentId: string) =>
    request<{ favorites: { meditationIds: string[]; inspirationIds: string[] } }>(BASE_URL, `/wellness/inspiration/favorites/${contentId}`, { method: 'POST' }),
  getFavoriteInspiration: () =>
    request<{ items: InspirationContent[] }>(BASE_URL, '/wellness/inspiration/favorites'),

  // Preferences
  getWellnessPreferences: () =>
    request<WellnessNotificationPreferences>(BASE_URL, '/wellness/preferences'),
  saveWellnessPreferences: (payload: Omit<WellnessNotificationPreferences, 'userId' | 'updatedAt'>) =>
    request<WellnessNotificationPreferences>(BASE_URL, '/wellness/preferences', { method: 'PUT', body: JSON.stringify(payload) }),

  // Analytics
  sendAnalyticsEvent: (type: string, data?: Record<string, string | number | boolean>) =>
    request<{ ok: true }>(BASE_URL, '/wellness/analytics/event', { method: 'POST', body: JSON.stringify({ type, data }) }),

  // AI Companion (plain request/response - the real route handler returns a
  // single JSON reply, not a stream, so this intentionally does not reuse
  // assistantStream.ts's XHR-streaming approach).
  sendCompanionMessage: (payload: { conversationId: string | null; message: string; includeJournalEntryId?: string; journalConsent?: boolean }) =>
    request<{ conversationId: string; reply: string; crisisFlag?: boolean; mode?: string; remainingToday?: number }>(BASE_URL, '/wellness/ai-companion/message', { method: 'POST', body: JSON.stringify(payload) }),
};
