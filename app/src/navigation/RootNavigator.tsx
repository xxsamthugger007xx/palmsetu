import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  NavigationContainer, DarkTheme, Theme, NavigationContainerRef,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ScanLine, Compass, Leaf, User } from 'lucide-react-native';
import { RootStackParamList, MainTabParamList } from './types';
import { color } from '../theme/tokens';
import { useUserProfile } from '../context/UserProfileContext';
import { useLanguage } from '../context/LanguageContext';
import { useOnboardingIntro } from '../context/OnboardingIntroContext';
import { FloatingAIButton } from '../components/FloatingAIButton';

import { LanguageSelectScreen } from '../screens/onboarding/LanguageSelectScreen';
import { IntroScreen } from '../screens/onboarding/IntroScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { PalmHubScreen } from '../screens/palm/PalmHubScreen';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { WellnessScreen } from '../screens/wellness/WellnessScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { PalmIntroScreen } from '../screens/palm/PalmIntroScreen';
import { PalmCaptureScreen } from '../screens/palm/PalmCaptureScreen';
import { PalmAnalyzingScreen } from '../screens/palm/PalmAnalyzingScreen';
import { PalmReportScreen } from '../screens/palm/PalmReportScreen';
import { PalmHistoryScreen } from '../screens/palm/PalmHistoryScreen';
import { CompanionScreen } from '../screens/companion/CompanionScreen';
import { PaywallScreen } from '../screens/paywall/PaywallScreen';
import { TarotLandingScreen } from '../screens/tarot/TarotLandingScreen';
import { TarotCategoryScreen } from '../screens/tarot/TarotCategoryScreen';
import { TarotSpreadScreen } from '../screens/tarot/TarotSpreadScreen';
import { TarotDrawScreen } from '../screens/tarot/TarotDrawScreen';
import { TarotReportScreen } from '../screens/tarot/TarotReportScreen';
import { TarotHistoryScreen } from '../screens/tarot/TarotHistoryScreen';
import { AstrologyLandingScreen } from '../screens/astrology/AstrologyLandingScreen';
import { AstrologyProfileSetupScreen } from '../screens/astrology/AstrologyProfileSetupScreen';
import { DailyHoroscopeScreen } from '../screens/astrology/DailyHoroscopeScreen';
import { RelationshipsScreen } from '../screens/astrology/RelationshipsScreen';
import { ConnectPartnerScreen } from '../screens/astrology/ConnectPartnerScreen';
import { RelationshipReportScreen } from '../screens/astrology/RelationshipReportScreen';
import { AstrologyHistoryScreen } from '../screens/astrology/AstrologyHistoryScreen';
import { AstrologyNotificationSettingsScreen } from '../screens/astrology/AstrologyNotificationSettingsScreen';
import { SelectAstrologyProfileScreen } from '../screens/astrology/SelectAstrologyProfileScreen';
import { KundliStyleScreen } from '../screens/astrology/KundliStyleScreen';
import { KundliResultScreen } from '../screens/astrology/KundliResultScreen';
import { SoulEnergyReadingScreen } from '../screens/astrology/SoulEnergyReadingScreen';
import { LanguageScreen } from '../screens/profile/LanguageScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SoulmateQuizScreen } from '../screens/discover/soulmate/SoulmateQuizScreen';
import { GemstoneLandingScreen } from '../screens/gemstone/GemstoneLandingScreen';
import { GemstoneGoalScreen } from '../screens/gemstone/GemstoneGoalScreen';
import { GemstoneReportScreen } from '../screens/gemstone/GemstoneReportScreen';
import { GemstoneHistoryScreen } from '../screens/gemstone/GemstoneHistoryScreen';
import { VastuLandingScreen } from '../screens/vastu/VastuLandingScreen';
import { VastuCompassScreen } from '../screens/vastu/VastuCompassScreen';
import { VastuPropertyFormScreen } from '../screens/vastu/VastuPropertyFormScreen';
import { VastuReportScreen } from '../screens/vastu/VastuReportScreen';
import { VastuHistoryScreen } from '../screens/vastu/VastuHistoryScreen';
import { AdminEntryScreen } from '../screens/admin/AdminEntryScreen';
import { AssistantChatScreen } from '../screens/assistant/AssistantChatScreen';
import { AssistantHistoryScreen } from '../screens/assistant/AssistantHistoryScreen';
import { MoonSignScreen } from '../screens/astrology/MoonSignScreen';
import { WesternAstrologyScreen } from '../screens/astrology/WesternAstrologyScreen';
import { HoroscopesScreen } from '../screens/horoscopes/HoroscopesScreen';
import { HoroscopeLauncherScreen } from '../screens/horoscopes/HoroscopeLauncherScreen';
import { NumerologyScreen } from '../screens/numerology/NumerologyScreen';
import { MyReportsScreen } from '../screens/reports/MyReportsScreen';
import { AdminOverviewScreen } from '../screens/admin/AdminOverviewScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminUserDetailScreen } from '../screens/admin/AdminUserDetailScreen';
import { AdminFeaturesScreen } from '../screens/admin/AdminFeaturesScreen';
import { AdminSystemScreen } from '../screens/admin/AdminSystemScreen';
import { MoodCheckInScreen } from '../screens/wellness/MoodCheckInScreen';
import { JournalScreen } from '../screens/wellness/JournalScreen';
import { JournalEditorScreen } from '../screens/wellness/JournalEditorScreen';
import { HabitsScreen } from '../screens/wellness/HabitsScreen';
import { MoodHistoryScreen } from '../screens/wellness/MoodHistoryScreen';
import { BreathingTechniquesScreen } from '../screens/wellness/BreathingTechniquesScreen';
import { BreathingSessionScreen } from '../screens/wellness/BreathingSessionScreen';
import { ChallengesScreen } from '../screens/wellness/ChallengesScreen';
import { ChallengeDetailScreen } from '../screens/wellness/ChallengeDetailScreen';
import { MeditationScreen } from '../screens/wellness/MeditationScreen';
import { MeditationPlayerScreen } from '../screens/wellness/MeditationPlayerScreen';
import { GoalsScreen } from '../screens/wellness/GoalsScreen';
import { GoalDetailScreen, GoalsCompletedScreen } from '../screens/wellness/GoalDetailScreen';
import { AffirmationDetailScreen } from '../screens/wellness/AffirmationDetailScreen';
import { InspirationBrowseScreen } from '../screens/wellness/InspirationBrowseScreen';
import { NotificationSettingsScreen } from '../screens/wellness/NotificationSettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: color.bg,
    card: color.surface,
    primary: color.accent,
    border: color.border,
    text: color.textPrimary,
  },
};

const tabIcon: Record<keyof MainTabParamList, typeof Home> = {
  Home: Home,
  PalmScan: ScanLine,
  Discover: Compass,
  Wellness: Leaf,
  Profile: User,
};

function MainTabs() {
  const { t } = useTranslation();
  const tabLabel: Record<keyof MainTabParamList, string> = {
    Home: t('nav.home'),
    PalmScan: t('nav.palmScan'),
    Discover: t('nav.discover'),
    Wellness: t('nav.wellness'),
    Profile: t('nav.profile'),
  };

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarIcon: ({ color: tint }) => {
          const Icon = tabIcon[route.name as keyof MainTabParamList];
          return <Icon size={22} color={tint} strokeWidth={1.75} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: tabLabel.Home }} />
      <Tabs.Screen name="PalmScan" component={PalmHubScreen} options={{ title: tabLabel.PalmScan }} />
      <Tabs.Screen name="Discover" component={DiscoverScreen} options={{ title: tabLabel.Discover }} />
      <Tabs.Screen name="Wellness" component={WellnessScreen} options={{ title: tabLabel.Wellness }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: tabLabel.Profile }} />
    </Tabs.Navigator>
  );
}

/** Maps a route name to the assistant's feature context. Screens not listed
 * here get `null` (general conversation, e.g. Home). */
const ROUTE_TO_FEATURE: Partial<Record<keyof RootStackParamList | keyof MainTabParamList, string>> = {
  TarotLanding: 'tarot', TarotCategory: 'tarot', TarotSpread: 'tarot',
  TarotDraw: 'tarot', TarotReport: 'tarot', TarotHistory: 'tarot',
  AstrologyLanding: 'astrology', AstrologyProfileSetup: 'astrology', DailyHoroscope: 'astrology',
  Relationships: 'astrology', ConnectPartner: 'astrology', RelationshipReport: 'astrology',
  AstrologyHistory: 'astrology', MoonSign: 'astrology', WesternAstrology: 'astrology',
  SelectAstrologyProfile: 'astrology', KundliStyle: 'astrology', KundliResult: 'astrology', SoulEnergyReading: 'astrology',
  GemstoneLanding: 'gemstone', GemstoneGoal: 'gemstone', GemstoneReport: 'gemstone', GemstoneHistory: 'gemstone',
  VastuLanding: 'vastu', VastuCompass: 'vastu', VastuPropertyForm: 'vastu', VastuReport: 'vastu', VastuHistory: 'vastu',
  PalmScan: 'palm', PalmReport: 'palm',
};

const MAIN_TAB_ROUTE_NAMES = new Set<keyof MainTabParamList>(['Home', 'PalmScan', 'Discover', 'Wellness', 'Profile']);

/** The floating "Ask AI" button appears on every main dashboard tab (Home,
 * Palm Scan, Discover, Wellness, Profile), but never once the user drills
 * into a feature's sub-screens (e.g. TarotLanding, DailyHoroscope,
 * GemstoneReport) - those are reached by pushing onto the stack, so they're
 * simply everything outside MAIN_TAB_ROUTE_NAMES. */
const SHOW_FLOATING_BUTTON_ON = MAIN_TAB_ROUTE_NAMES;

export function RootNavigator() {
  const { profile, loading: profileLoading } = useUserProfile();
  const { hasSelectedLanguage, loading: languageLoading } = useLanguage();
  const { hasSeenIntro, loading: introLoading } = useOnboardingIntro();
  const insets = useSafeAreaInsets();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>('Home');

  if (profileLoading || languageLoading || introLoading) {
    return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  }

  const showFloatingButton = !!profile && SHOW_FLOATING_BUTTON_ON.has(currentRouteName as keyof MainTabParamList);
  const screenContext = currentRouteName ? ROUTE_TO_FEATURE[currentRouteName as keyof RootStackParamList] : undefined;
  const onMainTab = MAIN_TAB_ROUTE_NAMES.has(currentRouteName as keyof MainTabParamList);
  // Clear the tab bar (height 64 + its own bottom padding) only when a tab
  // screen is active; stack screens have no tab bar to clear. The Wellness
  // home screen's redesigned bottom sections (Habit journey rows, the Goals
  // snippet) run interactive rows all the way to the bottom of the scroll
  // content, so it gets extra clearance to keep the floating orb from
  // sitting on top of a tappable row.
  const bottomOffset = onMainTab
    ? 64 + insets.bottom + (currentRouteName === 'Wellness' ? 28 : 0)
    : insets.bottom;

  return (
    <NavigationContainer
      theme={navTheme}
      ref={navRef}
      onReady={() => setCurrentRouteName(navRef.current?.getCurrentRoute()?.name)}
      onStateChange={() => setCurrentRouteName(navRef.current?.getCurrentRoute()?.name)}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasSelectedLanguage ? (
          <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
        ) : !hasSeenIntro ? (
          <Stack.Screen name="OnboardingIntro" component={IntroScreen} />
        ) : !profile ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="PalmIntro" component={PalmIntroScreen} />
            <Stack.Screen name="PalmCapture" component={PalmCaptureScreen} />
            <Stack.Screen name="PalmAnalyzing" component={PalmAnalyzingScreen} />
            <Stack.Screen name="PalmReport" component={PalmReportScreen} />
            <Stack.Screen name="PalmHistory" component={PalmHistoryScreen} />
            <Stack.Screen name="Companion" component={CompanionScreen} options={{ presentation: 'modal' }} />
            {/* Centralized assistant, distinct from the narrower Companion (wellness/palmistry) chat above -
                reasons across all of the user's real tarot/astrology/gemstone/vastu/palm data. */}
            <Stack.Screen name="AssistantChat" component={AssistantChatScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AssistantHistory" component={AssistantHistoryScreen} />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="TarotLanding" component={TarotLandingScreen} />
            <Stack.Screen name="TarotCategory" component={TarotCategoryScreen} />
            <Stack.Screen name="TarotSpread" component={TarotSpreadScreen} />
            <Stack.Screen name="TarotDraw" component={TarotDrawScreen} />
            <Stack.Screen name="TarotReport" component={TarotReportScreen} />
            <Stack.Screen name="TarotHistory" component={TarotHistoryScreen} />
            <Stack.Screen name="AstrologyLanding" component={AstrologyLandingScreen} />
            <Stack.Screen name="AstrologyProfileSetup" component={AstrologyProfileSetupScreen} />
            <Stack.Screen name="DailyHoroscope" component={DailyHoroscopeScreen} />
            <Stack.Screen name="Relationships" component={RelationshipsScreen} />
            <Stack.Screen name="ConnectPartner" component={ConnectPartnerScreen} />
            <Stack.Screen name="RelationshipReport" component={RelationshipReportScreen} />
            <Stack.Screen name="AstrologyHistory" component={AstrologyHistoryScreen} />
            <Stack.Screen name="AstrologyNotificationSettings" component={AstrologyNotificationSettingsScreen} />
            <Stack.Screen name="SelectAstrologyProfile" component={SelectAstrologyProfileScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="KundliStyle" component={KundliStyleScreen} />
            <Stack.Screen name="KundliResult" component={KundliResultScreen} />
            <Stack.Screen name="SoulEnergyReading" component={SoulEnergyReadingScreen} />
            <Stack.Screen name="MoonSign" component={MoonSignScreen} />
            <Stack.Screen name="WesternAstrology" component={WesternAstrologyScreen} />
            <Stack.Screen name="Horoscopes" component={HoroscopesScreen} />
            <Stack.Screen name="HoroscopeLauncher" component={HoroscopeLauncherScreen} />
            <Stack.Screen name="Numerology" component={NumerologyScreen} />
            <Stack.Screen name="MyReports" component={MyReportsScreen} />
            <Stack.Screen name="Language" component={LanguageScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="SoulmateQuiz" component={SoulmateQuizScreen} />
            <Stack.Screen name="GemstoneLanding" component={GemstoneLandingScreen} />
            <Stack.Screen name="GemstoneGoal" component={GemstoneGoalScreen} />
            <Stack.Screen name="GemstoneReport" component={GemstoneReportScreen} />
            <Stack.Screen name="GemstoneHistory" component={GemstoneHistoryScreen} />
            <Stack.Screen name="VastuLanding" component={VastuLandingScreen} />
            <Stack.Screen name="VastuCompass" component={VastuCompassScreen} />
            <Stack.Screen name="VastuPropertyForm" component={VastuPropertyFormScreen} />
            <Stack.Screen name="VastuReport" component={VastuReportScreen} />
            <Stack.Screen name="VastuHistory" component={VastuHistoryScreen} />

            <Stack.Screen name="MoodCheckIn" component={MoodCheckInScreen} />
            <Stack.Screen name="Journal" component={JournalScreen} />
            <Stack.Screen name="JournalEditor" component={JournalEditorScreen} />
            <Stack.Screen name="Habits" component={HabitsScreen} />
            <Stack.Screen name="MoodHistory" component={MoodHistoryScreen} />
            <Stack.Screen name="BreathingTechniques" component={BreathingTechniquesScreen} />
            <Stack.Screen name="BreathingSession" component={BreathingSessionScreen} />
            <Stack.Screen name="Challenges" component={ChallengesScreen} />
            <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
            <Stack.Screen name="Meditation" component={MeditationScreen} />
            <Stack.Screen name="MeditationPlayer" component={MeditationPlayerScreen} />
            <Stack.Screen name="Goals" component={GoalsScreen} />
            <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
            <Stack.Screen name="GoalsCompleted" component={GoalsCompletedScreen} />
            <Stack.Screen name="AffirmationDetail" component={AffirmationDetailScreen} />
            <Stack.Screen name="InspirationBrowse" component={InspirationBrowseScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />

            {/* Hidden admin panel - not reachable from any tab or visible menu.
                Reached only via a long-press on the Profile screen's avatar.
                See AdminEntryScreen for the (prototype-grade) access check. */}
            <Stack.Screen name="AdminEntry" component={AdminEntryScreen} />
            <Stack.Screen name="AdminOverview" component={AdminOverviewScreen} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
            <Stack.Screen name="AdminFeatures" component={AdminFeaturesScreen} />
            <Stack.Screen name="AdminSystem" component={AdminSystemScreen} />
          </>
        )}
      </Stack.Navigator>
      {showFloatingButton && (
        <FloatingAIButton
          bottomOffset={bottomOffset}
          onPress={() => navRef.current?.navigate('AssistantChat', screenContext ? { screenContext } : undefined)}
        />
      )}
    </NavigationContainer>
  );
}
