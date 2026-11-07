import { ReadingCategory, SpreadType } from '../types/tarot';

export type RootStackParamList = {
  LanguageSelect: undefined;
  OnboardingIntro: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  PalmIntro: undefined;
  PalmCapture: undefined;
  PalmAnalyzing: { imageUri: string; hand: 'left' | 'right' };
  PalmReport: { readingId: string; justCompleted?: boolean; selectedHand?: 'left' | 'right' };
  PalmHistory: undefined;
  Companion: { readingId?: string } | undefined;
  Paywall: undefined;
  TarotLanding: undefined;
  TarotCategory: { presetCategory?: ReadingCategory } | undefined;
  TarotSpread: { category: ReadingCategory; question: string | null };
  TarotDraw: { category: ReadingCategory; question: string | null; spreadType: SpreadType };
  TarotReport: { readingId: string };
  TarotHistory: undefined;
  AstrologyLanding: undefined;
  // returnTo: 'profile' when opened from the Profile screen to edit existing
  // birth details - saving goes straight back to Profile instead of into the
  // astrology section, since birth details are profile data, not step 1 of
  // an astrology flow. Omitted (or any other value) keeps the existing
  // behavior for every other entry point (empty-state prompts from within
  // astrology-adjacent screens, which reasonably continue into that feature).
  AstrologyProfileSetup: { returnTo?: 'profile' } | undefined;
  DailyHoroscope: { localDate: string };
  Relationships: undefined;
  ConnectPartner: undefined;
  RelationshipReport: { relationshipId: string; localDate: string };
  AstrologyHistory: undefined;
  AstrologyNotificationSettings: undefined;
  SelectAstrologyProfile: { path: 'vedic' | 'soulEnergy' };
  KundliStyle: { subject: 'self' | 'other' };
  KundliResult: { chartId: string };
  SoulEnergyReading: undefined;
  Language: undefined;
  EditProfile: undefined;
  SoulmateQuiz: undefined;
  GemstoneLanding: undefined;
  GemstoneGoal: undefined;
  GemstoneReport: { reportId: string };
  GemstoneHistory: undefined;
  VastuLanding: undefined;
  VastuCompass: undefined;
  VastuPropertyForm: undefined;
  VastuReport: { reportId: string };
  VastuHistory: undefined;
  AssistantChat: { conversationId?: string; screenContext?: string } | undefined;
  AssistantHistory: undefined;
  MoonSign: undefined;
  WesternAstrology: undefined;
  Horoscopes: undefined;
  HoroscopeLauncher: undefined;
  Numerology: undefined;
  MyReports: undefined;
  AdminEntry: undefined;
  AdminOverview: undefined;
  AdminUsers: undefined;
  AdminUserDetail: { userId: string };
  AdminFeatures: undefined;
  AdminSystem: undefined;
  MoodCheckIn: undefined;
  Journal: undefined;
  JournalEditor: { entryId?: string } | undefined;
  Habits: undefined;
  MoodHistory: undefined;
  BreathingTechniques: undefined;
  BreathingSession: { technique: import('../services/wellnessApi').BreathingTechniqueCatalogueEntry };
  Challenges: undefined;
  ChallengeDetail: { id: string };
  Meditation: undefined;
  MeditationPlayer: { contentId: string };
  Goals: undefined;
  GoalDetail: { id: string };
  GoalsCompleted: undefined;
  AffirmationDetail: { content?: import('../services/wellnessApi').InspirationContent } | undefined;
  InspirationBrowse: undefined;
  NotificationSettings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  PalmScan: undefined;
  Discover: undefined;
  Wellness: undefined;
  Profile: undefined;
};
