import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronRight, Hand, Layers } from 'lucide-react-native';
import { FadeInUp } from '../../components/FadeInUp';
import { StreakChip } from '../../components/StreakChip';
import { HeroActionCard } from '../../components/HeroActionCard';
import { ErrorBanner } from '../../components/ErrorState';
import { isLoadFailure } from '../../utils/loadFailure';
import { PageContainer } from '../../components/PageContainer';
import { AppHeader } from '../../components/AppHeader';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { StatusBadge } from '../../components/StatusBadge';
import { FadeDivider } from '../../components/FadeDivider';
import { InstrumentDial } from '../../components/InstrumentDial';
import { MoodPulseSelector, MoodMarkBadge, moodLabel } from '../../components/wellness/MoodPulse';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useUserProfile } from '../../context/UserProfileContext';
import { astrologyApi } from '../../services/astrologyApi';
import { palmApi } from '../../services/palmApi';
import { wellnessApi, MoodLevel, MoodEntry } from '../../services/wellnessApi';
import { BirthProfile, DailyHoroscope } from '../../types/astrology';
import { PalmReading } from '../../types/palm';
import { degreeReadout } from '../../utils/astrology';
import { formatLongDate } from '../../utils/formatDate';
import { timeOfDayGreetingKey } from './homeSections';
import { TransitsCard } from './TransitsCard';
import { DailyGuidanceCard } from './DailyGuidanceCard';
import { StreakCard } from '../../components/StreakCard';
import { useDailyStreak } from '../../hooks/useDailyStreak';
import { useIsPremium } from '../../hooks/useIsPremium';
import { PalmInsightCard } from './PalmInsightCard';
import { SectionsGrid } from './SectionsGrid';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { streak } = useDailyStreak();
  const isPremium = useIsPremium();
  const { profile } = useUserProfile();
  const [astroProfile, setAstroProfile] = React.useState<BirthProfile | null>(null);
  const [dailyHoroscope, setDailyHoroscope] = React.useState<DailyHoroscope | null>(null);
  const [todayMood, setTodayMood] = React.useState<MoodEntry | null>(null);
  const [quickMood, setQuickMood] = React.useState<MoodLevel | null>(null);
  const [savingMood, setSavingMood] = React.useState(false);
  const [latestPalmReading, setLatestPalmReading] = React.useState<PalmReading | null | undefined>(undefined); // undefined = still loading, null = none exist

  const [loadFailed, setLoadFailed] = React.useState(false);

  const loadHomeData = React.useCallback(async () => {
    setLoadFailed(false);
    const noteFailure = (err: unknown) => { if (isLoadFailure(err)) setLoadFailed(true); };
    await astrologyApi
      .getProfile()
      .then((p) => {
        setAstroProfile(p);
        // Real transit longitudes/degrees only come from the daily
        // horoscope's transitContext - fetch it once we know a profile
        // exists, so the dial can show an honest degree readout instead
        // of just a sign name. Never block the profile-based empty state
        // on this call failing.
        return astrologyApi.getDaily(astrologyApi.todayLocalDate()).then((res) => {
          setDailyHoroscope(res.generationStatus === 'ready' ? res : null);
        });
      })
      .catch((err) => {
        setAstroProfile(null); // honest empty state below if no profile (404) or any fetch error
        setDailyHoroscope(null);
        noteFailure(err); // ...but offline/5xx also shows a retry banner, so it isn't mistaken for a new account
      });

    const today = wellnessApi.todayLocalDate();
    await wellnessApi.getMoodForDate(today)
      .then((res) => setTodayMood(res.entry))
      .catch((err) => { setTodayMood(null); noteFailure(err); });

    await palmApi.listReadings()
      .then((res) => setLatestPalmReading(res.items[0] ?? null))
      .catch((err) => { setLatestPalmReading(null); noteFailure(err); });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadHomeData();
    }, [loadHomeData])
  );

  const quickSaveMood = async (mood: MoodLevel) => {
    setQuickMood(mood);
    setSavingMood(true);
    try {
      const today = wellnessApi.todayLocalDate();
      const res = await wellnessApi.saveMood({ localDate: today, mood, energy: 3, stress: 3, sleepQuality: 3 });
      setTodayMood(res.entry);
    } catch {
      setQuickMood(null); // honest failure: no optimistic state kept
    } finally {
      setSavingMood(false);
    }
  };

  // Whichever astrology system the user has selected, every sign shown here
  // must come from that system's own longitude - previously this screen
  // always read the sidereal (Vedic) natal fields regardless of the user's
  // actual preference, so switching to Western never changed anything shown.
  const isVedic = astroProfile?.preferredSystem === 'vedic';
  const transitContext = dailyHoroscope?.transitContext;

  // Sun and Moon are never present in transitContext.planets (only the five
  // outer-to-inner planets are) - they're computed separately and exposed as
  // top-level transitContext fields. Build matching { body, sign, longitude }
  // entries from those real fields so the dial can treat all five bodies the
  // same way, instead of silently excluding Sun/Moon from the display.
  const moonTransit = transitContext
    ? {
        body: 'Moon',
        sign: isVedic ? transitContext.moonSignSidereal : transitContext.moonSignTropical,
        longitude: isVedic ? transitContext.moonSiderealLongitude : transitContext.moonTropicalLongitude,
        retrograde: false,
      }
    : null;
  const sunTransit = transitContext
    ? {
        body: 'Sun',
        sign: isVedic ? transitContext.sunSignSidereal : transitContext.sunSign,
        longitude: transitContext.sunLongitude, // Sun's own longitude is system-independent for marker placement purposes here; only the sign label differs
        retrograde: false,
      }
    : null;
  const otherTransits = (transitContext?.planets ?? [])
    .filter((p) => ['Mars', 'Venus', 'Jupiter'].includes(p.body))
    .map((p) => ({
      body: p.body,
      sign: isVedic ? p.signSidereal : p.sign,
      longitude: isVedic ? p.longitudeSidereal : p.longitude,
      retrograde: p.retrograde,
    }));
  // "Today for you": the real Moon sign plus the day's own theme, in one line. Nothing is shown until a chart exists.
  const todayForYou = moonTransit && dailyHoroscope?.dailyTheme
    ? `${t('home.moonInSign', { sign: moonTransit.sign })} \u00B7 ${dailyHoroscope.dailyTheme}`
    : null;

  const notableTransits = [sunTransit, moonTransit, ...otherTransits].filter(
    (p): p is { body: string; sign: string; longitude: number; retrograde: boolean } => p !== null
  );

  if (!profile) return null; // navigator guards this, but keeps TS happy

  return (
    <PageContainer onRefresh={loadHomeData} stars>
      {loadFailed && <ErrorBanner message={t('ui.HomeScreen.someContentCouldnTBe')} onRetry={loadHomeData} />}
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Sparkles size={13} color={color.accent} strokeWidth={2} />
        </View>
        <Text variant="label" tone="accent" style={styles.brandWordmark}>{t('ui.HomeScreen.palmSetu')}</Text>
      </View>

      <AppHeader
        greeting={t(timeOfDayGreetingKey())}
        name={profile.name}
        gender={profile.gender}
        hasNotifications
        subtitle={todayForYou}
        trailing={streak ? <StreakChip days={streak.current} atRisk={streak.atRisk} onPress={() => navigation.navigate('NotificationSettings')} /> : undefined}
      />

      <Text variant="caption" tone="accent" weight="semibold" style={styles.todayDate}>
        {formatLongDate(new Date()).toUpperCase()}
      </Text>

      <FadeInUp delay={80}>
      {latestPalmReading === null ? (
        <HeroActionCard
          icon={Hand}
          colors={['#8A5CD6', '#3A2A6B']}
          title={t('home.hero.palmTitle')}
          description={t('home.hero.palmDesc')}
          cta={t('home.hero.palmCta')}
          onPress={() => navigation.navigate('PalmIntro')}
        />
      ) : latestPalmReading ? (
        <HeroActionCard
          icon={Layers}
          title={t('home.hero.cardTitle')}
          description={t('home.hero.cardDesc')}
          cta={t('home.hero.cardCta')}
          onPress={() => navigation.navigate('TarotLanding')}
        />
      ) : null}
      </FadeInUp>

      <FadeInUp delay={200}>
      <View style={styles.dialSection}>
        <Pressable accessibilityRole="button"
          onPress={() => astroProfile && navigation.navigate('MoonSign')}
          disabled={!astroProfile}
        >
          {astroProfile && moonTransit ? (
            <InstrumentDial
              label={t('home.moonTonightLabel')}
              readout={degreeReadout(moonTransit.longitude)}
              statusLine={`${moonTransit.sign} · ${dailyHoroscope?.transitContext.moonPhase ?? ''}`}
              markers={notableTransits.map((p) => ({
                key: p.body,
                angleDeg: (p.longitude / 360) * 360,
                emphasis: p.body === 'Moon' || p.body === 'Sun',
              }))}
            />
          ) : astroProfile ? (
            <InstrumentDial
              label={t('home.moonLabel')}
              readout={isVedic ? astroProfile.natal.moonSignSidereal : astroProfile.natal.moonSignTropical}
              statusLine={
                isVedic
                  ? `${astroProfile.natal.moonNakshatra} · Pada ${astroProfile.natal.moonNakshatraPada}`
                  : t('home.moonWesternLabel')
              }
              markerAngleDeg={(astroProfile.natal.moonNakshatraPada - 1) * 90}
            />
          ) : (
            <InstrumentDial label={t('home.moonLabel')} readout={t('home.moonPlaceholderReadout')} statusLine={t('home.moonAddBirthDetails')} />
          )}
        </Pressable>
        {!astroProfile && (
          <Text
            variant="bodySm"
            tone="accent"
            style={{ marginTop: spacing.sm }}
            onPress={() => navigation.navigate('AstrologyProfileSetup')}
          >
            {t('home.setUpProfile')}
          </Text>
        )}
      </View>
      </FadeInUp>

      {streak && (streak.atRisk || streak.milestone) && <StreakCard streak={streak} onRemindersPress={streak.current > 0 && streak.current < 3 ? () => navigation.navigate('NotificationSettings') : undefined} />}
      {astroProfile && <FadeInUp delay={320}><DailyGuidanceCard dailyHoroscope={dailyHoroscope} /></FadeInUp>}

      <Card elevated style={{ marginBottom: spacing.sm }}>
        <View style={styles.cardHeaderRow}>
          <Text variant="label" tone="accent">{t('home.feelingTitle')}</Text>
        </View>
        {todayMood ? (
          <Pressable accessibilityRole="button"
            onPress={() => navigation.navigate('MoodCheckIn')}
            style={[styles.cardHeaderRow, { marginTop: spacing.sm }]}
          >
            <MoodMarkBadge mood={todayMood.mood} size={32} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="bodySm" weight="semibold">{t('common.feelingToday', { mood: moodLabel(todayMood.mood).toLowerCase() })}</Text>
              <Text variant="caption" tone="muted">{t('common.tapToEditCheckIn')}</Text>
            </View>
            <ChevronRight size={16} color={color.textMuted} />
          </Pressable>
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            <MoodPulseSelector value={quickMood} onSelect={quickSaveMood} />
            {savingMood && <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{t('common.saving')}</Text>}
          </View>
        )}
        <Text
          variant="caption"
          tone="accent"
          style={{ marginTop: spacing.sm }}
          onPress={() => navigation.navigate('Wellness' as never)}
        >
          {t('home.goToWellness')}
        </Text>
      </Card>

      <PalmInsightCard latestPalmReading={latestPalmReading} />

      <TransitsCard transits={notableTransits} />

      <FadeDivider style={{ marginVertical: spacing.lg }} />

      {!isPremium && (
      <Card elevated onPress={() => navigation.navigate('Paywall')} style={styles.upgradeCard}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="accent">{t('home.premiumTitle')}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
            {t('home.premiumDesc')}
          </Text>
        </View>
        <StatusBadge label={t('common.upgrade')} status="accent" />
      </Card>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('home.exploreTitle')} />
        <SectionsGrid />
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentMuted,
    borderWidth: 1,
    borderColor: color.accentBorder,
    marginRight: spacing.xs,
  },
  brandWordmark: {
    letterSpacing: 2.5,
  },
  todayDate: {
    letterSpacing: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  dialSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  upgradeCard: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
