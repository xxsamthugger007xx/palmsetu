import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tick } from '../../services/haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { signName } from '../../utils/signName';
import { ChevronRight, Hand, Layers } from 'lucide-react-native';
import { FadeInUp } from '../../components/FadeInUp';
import { StreakChip } from '../../components/StreakChip';
import { StreakDetailModal } from '../../components/StreakDetailModal';
import { HeroActionCard } from '../../components/HeroActionCard';
import { ErrorBanner } from '../../components/ErrorState';
import { isLoadFailure } from '../../utils/loadFailure';
import { PageContainer } from '../../components/PageContainer';
import { AppHeader } from '../../components/AppHeader';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { FadeDivider } from '../../components/FadeDivider';
import { InstrumentDial } from '../../components/InstrumentDial';
import { MoodPulseSelector, MoodMarkBadge, moodLabel } from '../../components/wellness/MoodPulse';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useUserProfile } from '../../context/UserProfileContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { astrologyApi } from '../../services/astrologyApi';
import { palmApi } from '../../services/palmApi';
import { tarotApi } from '../../services/tarotApi';
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
  const [showStreakModal, setShowStreakModal] = React.useState(false);
  const [savingMood, setSavingMood] = React.useState(false);
  const [latestPalmReading, setLatestPalmReading] = React.useState<PalmReading | null | undefined>(undefined); // undefined = still loading, null = none exist
  const [dailyCardRevealedToday, setDailyCardRevealedToday] = React.useState<boolean | undefined>(undefined); // undefined = still loading

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

    // Whether today's daily tarot card has already been flipped/revealed -
    // mirrors TarotLandingScreen's own AsyncStorage key exactly, so the two
    // screens always agree on "already drawn today" without a second
    // source of truth. getDailyCard() is idempotent per local day (it
    // creates/returns the same record all day), so calling it here has no
    // side effect beyond what TarotLandingScreen already does on its own
    // mount.
    await tarotApi.getDailyCard()
      .then(async (res) => {
        const revealed = await AsyncStorage.getItem(`tarot_daily_revealed:${res.daily.readingId}`);
        setDailyCardRevealedToday(revealed === 'true');
      })
      .catch(() => setDailyCardRevealedToday(false)); // honest fallback: never block the hero card on this failing
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadHomeData();
    }, [loadHomeData])
  );

  const quickSaveMood = async (mood: MoodLevel) => {
    tick();
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
    ? `${t('home.moonInSign', { sign: signName(t, moonTransit.sign) })} \u00B7 ${dailyHoroscope.dailyTheme}`
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
          <Image source={require('../../../assets/palm-setu-mark.png')} style={styles.brandMarkImage} resizeMode="cover" />
        </View>
        <Text variant="label" tone="accent" style={styles.brandWordmark} numberOfLines={1}>{t('ui.HomeScreen.palmSetu')}</Text>
      </View>

      <AppHeader
        greeting={t(timeOfDayGreetingKey())}
        name={profile.name}
        gender={profile.gender}
        avatarIndex={profile.avatarIndex}
        avatarKey={profile.avatarKey}
        hasNotifications
        onNotificationsPress={() => navigation.navigate('NotificationSettings')}
        subtitle={todayForYou}
        trailing={
          streak ? (
            <StreakChip
              days={streak.current}
              atRisk={streak.atRisk}
              onPress={() => setShowStreakModal(true)}
            />
          ) : undefined
        }
      />

      {streak && (
        <StreakDetailModal
          visible={showStreakModal}
          streak={streak}
          onClose={() => setShowStreakModal(false)}
          onRemindersPress={
            streak.current > 0 && streak.current < 3
              ? () => { setShowStreakModal(false); navigation.navigate('NotificationSettings'); }
              : undefined
          }
        />
      )}

      <Text variant="caption" tone="accent" weight="semibold" style={styles.todayDate}>
        {formatLongDate(new Date()).toUpperCase()}
      </Text>

      <FadeInUp delay={80}>
      {latestPalmReading === null ? (
        <HeroActionCard
          compact
          icon={Hand}
          colors={['#8A5CD6', '#3A2A6B']}
          title={t('home.hero.palmTitle')}
          description={t('home.hero.palmDesc')}
          cta={t('home.hero.palmCta')}
          onPress={() => navigation.navigate('PalmIntro')}
        />
      ) : latestPalmReading && dailyCardRevealedToday === false ? (
        <HeroActionCard
          compact
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
              statusLine={`${signName(t, moonTransit.sign)} · ${dailyHoroscope?.transitContext.moonPhase ? t(`moonPhases.${dailyHoroscope.transitContext.moonPhase}`, { defaultValue: dailyHoroscope.transitContext.moonPhase }) : ''}`}
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

      <FadeInUp delay={380}>
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
      </FadeInUp>

      <FadeInUp delay={440}><PalmInsightCard latestPalmReading={latestPalmReading} /></FadeInUp>

      <FadeInUp delay={500}><TransitsCard transits={notableTransits} /></FadeInUp>

      <FadeDivider style={{ marginVertical: spacing.lg }} />

      {!isPremium && (
      <FadeInUp delay={560}>
      <Pressable onPress={() => navigation.navigate('Paywall')} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
        <LinearGradient colors={['#E8B85C', '#5A451C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upgradeCard}>
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="semibold" style={{ color: '#2B2741' }}>{t('home.premiumTitle')}</Text>
            <Text variant="bodySm" style={{ marginTop: 2, color: 'rgba(43,39,65,0.75)' }}>
              {t('home.premiumDesc')}
            </Text>
          </View>
          <View style={styles.upgradeBadge}>
            <Text variant="bodySm" weight="semibold" style={{ color: '#2B2741' }}>{t('common.upgrade')}</Text>
          </View>
        </LinearGradient>
      </Pressable>
      </FadeInUp>
      )}

      <FadeInUp delay={620}>
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('home.exploreTitle')} />
        <SectionsGrid />
      </View>
      </FadeInUp>
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
    paddingRight: 96,
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
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  brandMarkImage: {
    width: '100%',
    height: '100%',
  },
  brandWordmark: {
    letterSpacing: 2.5,
    lineHeight: 16,
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
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  upgradeBadge: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
});
