import { ReadingCategory, SpreadType } from '../types/tarot';

export type RootStackParamList = {
  LanguageSelect: undefined;
  OnboardingIntro: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  PalmIntro: { allowRescan?: boolean } | undefined;
  PalmCapture: { allowRescan?: boolean } | undefined;
  PalmAnalyzing: { imageUri: string; hand: 'left' | 'right'; allowRescan?: boolean };
  PalmReport: { readingId: string; justCompleted?: boolean; selectedHand?: 'left' | 'right' };
  PalmHistory: undefined;
  Companion: { readingId?: string } | undefined;
  Paywall: undefined;
  TarotLanding: undefined;
  TarotCategory: { presetCategory?: ReadingCategory } | undefined;
  TarotSpread: {
    category: ReadingCategory;
    question: string | null;
    /** Only offer these spreads (a landing tile picks its own spread instead of the full list). Preselected when there is one. */
    spreadIds?: SpreadType[];
    /** Whether to ask for a question on the spread screen. */
    questionMode?: 'none' | 'optional' | 'required';
  };
  TarotDraw: {
    category: ReadingCategory;
    question: string | null;
    spreadType: SpreadType;
    secondPersonName?: string | null;
    /** When set, this is the Daily Card's reveal ceremony - the draw screen
     * fetches this EXISTING reading instead of creating a new one (the
     * daily card's identity was already fixed by the real daily-assignment
     * logic in GET /tarot/daily, long before this screen ever opens; this
     * screen only supplies the premium tap-to-reveal interaction). */
    existingReadingId?: string;
  };
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
  // Step-by-step astrology onboarding, run once after identity onboarding
  // for every user who doesn't yet have a complete real BirthProfile (both
  // brand-new users and pre-existing users who only ever had UserIdentity).
  // Renders its own nested stack (see AstrologyOnboardingStack) whose
  // screens read/write the real backend-persisted OnboardingDraft so
  // progress survives the app being closed mid-flow. See utils/onboardingStep.ts.
  AstrologyOnboarding: undefined;
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
  SoulmateIntro: undefined;
  SoulmateQuestionnaire: { intent: 'free' | 'paid' };
  SoulmatePayment: {
    preferredGender: 'male' | 'female' | 'no-preference';
    preferredAgeRange: '18-24' | '25-30' | '31-35' | '36-40' | '40+';
    preferredCountry: string;
    style: 'pencil' | 'charcoal' | 'soft-portrait';
  };
  SoulmateGenerating: { sketchId: string };
  SoulmateResult: { sketchId: string };
  SoulmateHistory: undefined;
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
  // mode: which tab to open on - defaults to signup (the primary CTA from
  // contextual save-prompts). intent carries the contextual copy the
  // prompt that sent the user here should show (see SignUpPrompt).
  Auth: { mode?: 'signup' | 'login'; intent?: string } | undefined;
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
