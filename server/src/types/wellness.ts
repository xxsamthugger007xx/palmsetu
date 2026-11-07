/**
 * Wellness module types. Backend/data-model only - see server/src/routes/wellness.ts
 * for the routes that read/write these, and server/src/wellness/entitlements.ts for
 * every free/premium threshold referenced in comments below.
 */

export type MoodLevel = 'great' | 'good' | 'okay' | 'down' | 'low';

export const EMOTION_OPTIONS = [
  'happy', 'calm', 'excited', 'grateful', 'motivated', 'relaxed', 'anxious', 'stressed',
  'sad', 'lonely', 'frustrated', 'tired', 'overwhelmed', 'confident', 'hopeful',
] as const;
export type Emotion = typeof EMOTION_OPTIONS[number];

/** One check-in per user per local calendar day - key is `${userId}:${localDate}`,
 * same idempotent-per-day pattern as dailyTarotByUserDate/dailyHoroscopesByKey. */
export interface MoodEntry {
  id: string;
  userId: string;
  localDate: string; // YYYY-MM-DD, user's local calendar day
  mood: MoodLevel;
  emotions: Emotion[];
  energy: number; // 1-5
  stress: number; // 1-5
  sleepQuality: number; // 1-5
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
  /** true while the entry is an unfinished draft (autosave target); false once
   * the user explicitly finalizes it. A draft can still be read back/edited -
   * this is not a separate storage location, just a status flag on the same
   * record, which keeps autosave trivial (just PUT the same id repeatedly). */
  isDraft: boolean;
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export const BREATHING_TECHNIQUES = ['box', '4-7-8', 'deep', 'relaxation', 'focus', 'short-mindfulness'] as const;
export type BreathingTechnique = typeof BREATHING_TECHNIQUES[number];

export interface BreathingSession {
  id: string;
  userId: string;
  technique: BreathingTechnique;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  completed: boolean; // honestly recorded - an abandoned session is completed:false, never discarded
  createdAt: string;
}

export type HabitFrequency = 'daily' | 'weekly' | 'specific_days';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  /** Only used when frequency === 'specific_days'. 0=Sunday..6=Saturday. */
  specificDays?: number[];
  /** Stored user preference only - actual local notification scheduling is a
   * frontend (expo-notifications) concern, this server never sends anything. */
  reminderTime?: string | null;
  target?: string;
  active: boolean;
  createdAt: string;
  archivedAt?: string | null;
}

/** key: `${habitId}:${localDate}` */
export interface HabitCompletion {
  habitId: string;
  userId: string;
  localDate: string;
  completedAt: string;
}

export type ChallengeDuration = 7 | 21;

export interface ChallengeTask {
  day: number;
  title: string;
  description: string;
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  durationDays: ChallengeDuration;
  /** 'full' = every day has distinct written content; 'weekly_theme' = a
   * documented repeating thematic structure (used for the 21-day challenges
   * to avoid writing 63 fully-distinct days where a weekly theme is honest
   * and sufficient - see content.ts for which challenges use which). */
  contentDepth: 'full' | 'weekly_theme';
  tasks: ChallengeTask[];
  premium: boolean;
}

export type ChallengeStatus = 'active' | 'completed' | 'abandoned';

/** key: `${userId}:${challengeId}` */
export interface ChallengeProgress {
  userId: string;
  challengeId: string;
  joinedAt: string;
  currentDay: number; // 1-indexed, next day to complete
  completedDays: number[];
  status: ChallengeStatus;
  restartedAt?: string | null;
  lastCompletedAt?: string | null;
}

export interface PredefinedHabit {
  id: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  category: string;
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

/** One playback session record per play attempt. */
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
  /** Always user-reported - this app has no device/health integration, so
   * progress is never automatically measured. */
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
  targetFrequency?: string; // free-text, e.g. "4x per week"
  targetDuration?: string; // free-text, e.g. "30 minutes"
  deadline?: string | null; // YYYY-MM-DD
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
  /** Astrology-flavored content is an explicitly labeled optional subset,
   * never mixed indistinguishably into the general pool (per spec). */
  astrologyFlavored: boolean;
}

/** key: userId - tracks which inspiration ids were shown and when, so the
 * no-repeat window can look back further than just "today". */
export interface InspirationHistory {
  userId: string;
  shown: { contentId: string; localDate: string }[];
  todayContentId: string | null;
  todayLocalDate: string | null;
}

/** key: userId */
export interface WellnessFavorites {
  userId: string;
  meditationIds: string[];
  inspirationIds: string[];
}

/** key: userId - preference STORAGE only, mirrors deliveryPreferences in
 * astrology.ts exactly. Actual local notification scheduling/delivery is the
 * app's (expo-notifications) job, not this server's. */
export interface WellnessNotificationPreferences {
  userId: string;
  moodReminderEnabled: boolean;
  moodReminderTime: string; // "HH:MM"
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

export interface WellnessAiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WellnessAiConversation {
  id: string;
  userId: string;
  messages: WellnessAiMessage[];
  createdAt: string;
}

/** Analytics event names - metadata only, NEVER journal text or free-text
 * note content. See server/src/wellness/analytics.ts for the write helper
 * and the runtime guard against sensitive fields. */
export type WellnessAnalyticsEventType =
  | 'mood_checkin_completed' | 'journal_entry_created' | 'journal_entry_favorited'
  | 'breathing_session_completed' | 'breathing_session_abandoned'
  | 'habit_created' | 'habit_completed' | 'challenge_joined' | 'challenge_completed'
  | 'challenge_restarted' | 'meditation_session_started' | 'meditation_session_completed'
  | 'goal_created' | 'goal_completed' | 'inspiration_favorited' | 'ai_companion_message_sent'
  | 'ai_companion_crisis_detected';

export interface WellnessAnalyticsEvent {
  id: string;
  userId: string;
  type: WellnessAnalyticsEventType;
  createdAt: string;
  /** Structured, non-sensitive fields only: ids, enums, counts, booleans.
   * Never free text. Enforced at the call site (analytics.ts) by type. */
  data: Record<string, string | number | boolean>;
}
