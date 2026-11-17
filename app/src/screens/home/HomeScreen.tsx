import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ScanLine, Layers, Sparkles, Moon, Sun, Heart, Rocket, Hash, MessageCircle,
  FolderClock, LucideIcon, ChevronRight, PenLine,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { AppHeader } from '../../components/AppHeader';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { StatusBadge } from '../../components/StatusBadge';
import { FadeDivider } from '../../components/FadeDivider';
import { InstrumentDial } from '../../components/InstrumentDial';
import { Button } from '../../components/Button';
import { MoodPulseSelector, MoodMarkBadge, moodLabel } from '../../components/wellness/MoodPulse';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useUserProfile } from '../../context/UserProfileContext';
import { astrologyApi } from '../../services/astrologyApi';
import { palmApi } from '../../services/palmApi';
import { wellnessApi, MoodLevel, MoodEntry } from '../../services/wellnessApi';
import { BirthProfile, DailyHoroscope } from '../../types/astrology';
import { PalmReading } from '../../types/palm';
import { degreeReadout } from '../../utils/astrology';
import { formatLongDate } from '../../utils/formatDate';

type NotableTransit = { body: string; sign: string; longitude: number; retrograde: boolean };

function timeOfDayGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'common.greetingMorning';
  if (hour < 18) return 'common.greetingAfternoon';
  return 'common.greetingEvening';
}

type SectionCard = {
  id: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  navigate: (navigation: NativeStackNavigationProp<RootStackParamList>) => void;
};

/**
 * The 12 top-level sections requested for the redesigned home screen. Most
 * reuse real, already-working screens; a few are honest "coming soon"
 * placeholders where no backend capability exists yet (see each target
 * screen's own comment for what was checked). No premium badges are shown
 * here because no real entitlement/tier system exists in this app yet
 * (PaywallScreen itself is still unwired - BILLING_CONFIGURED = false) -
 * adding fake badges would violate the "never hardcode" rule, so this list
 * intentionally carries none.
 */
const sections: SectionCard[] = [
  {
    id: 'palm',
    icon: ScanLine,
    navigate: (nav) => nav.navigate('PalmIntro'),
  },
  {
    id: 'tarot',
    icon: Layers,
    navigate: (nav) => nav.navigate('TarotLanding'),
  },
  {
    id: 'astrology',
    icon: Sparkles,
    navigate: (nav) => nav.navigate('AstrologyLanding'),
  },
  {
    id: 'moonsign',
    icon: Moon,
    navigate: (nav) => nav.navigate('MoonSign'),
  },
  {
    id: 'dailyreport',
    icon: Sun,
    navigate: (nav) => nav.navigate('DailyHoroscope', { localDate: astrologyApi.todayLocalDate() }),
  },
  {
    id: 'horoscopes',
    icon: Sun,
    comingSoon: true,
    navigate: (nav) => nav.navigate('Horoscopes'),
  },
  {
    id: 'lovetest',
    icon: Heart,
    navigate: (nav) => nav.navigate('Relationships'),
  },
  {
    id: 'horoscopelauncher',
    icon: Rocket,
    comingSoon: true,
    navigate: (nav) => nav.navigate('HoroscopeLauncher'),
  },
  {
    id: 'numerology',
    icon: Hash,
    comingSoon: true,
    navigate: (nav) => nav.navigate('Numerology'),
  },
  {
    id: 'western',
    icon: Sun,
    navigate: (nav) => nav.navigate('WesternAstrology'),
  },
  {
    id: 'aichat',
    icon: MessageCircle,
    navigate: (nav) => nav.navigate('AssistantChat', undefined),
  },
  {
    id: 'myreports',
    icon: FolderClock,
    navigate: (nav) => nav.navigate('MyReports'),
  },
  {
    id: 'soulmate',
    icon: PenLine,
    navigate: (nav) => nav.navigate('SoulmateIntro'),
  },
];

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useUserProfile();
  const [astroProfile, setAstroProfile] = React.useState<BirthProfile | null>(null);
  const [dailyHoroscope, setDailyHoroscope] = React.useState<DailyHoroscope | null>(null);
  const [selectedTransit, setSelectedTransit] = React.useState<NotableTransit | null>(null);
  const [todayMood, setTodayMood] = React.useState<MoodEntry | null>(null);
  const [quickMood, setQuickMood] = React.useState<MoodLevel | null>(null);
  const [savingMood, setSavingMood] = React.useState(false);
  const [latestPalmReading, setLatestPalmReading] = React.useState<PalmReading | null | undefined>(undefined); // undefined = still loading, null = none exist

  const loadHomeData = React.useCallback(async () => {
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
      .catch(() => {
        setAstroProfile(null); // honest empty state below if no profile (404) or any fetch error
        setDailyHoroscope(null);
      });

    const today = wellnessApi.todayLocalDate();
    await wellnessApi.getMoodForDate(today)
      .then((res) => setTodayMood(res.entry))
      .catch(() => setTodayMood(null));

    await palmApi.listReadings()
      .then((res) => setLatestPalmReading(res.items[0] ?? null))
      .catch(() => setLatestPalmReading(null));
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
  const notableTransits = [sunTransit, moonTransit, ...otherTransits].filter(
    (p): p is { body: string; sign: string; longitude: number; retrograde: boolean } => p !== null
  );

  if (!profile) return null; // navigator guards this, but keeps TS happy

  return (
    <PageContainer onRefresh={loadHomeData}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Sparkles size={13} color={color.accent} strokeWidth={2} />
        </View>
        <Text variant="label" tone="accent" style={styles.brandWordmark}>PALM SETU</Text>
      </View>

      <AppHeader greeting={t(timeOfDayGreetingKey())} name={profile.name} gender={profile.gender} hasNotifications />

      <Text variant="caption" tone="accent" weight="semibold" style={styles.todayDate}>
        {formatLongDate(new Date()).toUpperCase()}
      </Text>

      <View style={styles.dialSection}>
        <Pressable
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

      {notableTransits.length > 0 && (
        <Card style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>{t('home.todaysTransits')}</Text>
          <View style={styles.transitHeaderRow}>
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>{t('home.transitBody')}</Text>
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>{t('home.transitSign')}</Text>
            <Text variant="caption" tone="muted" style={{ flex: 1, textAlign: 'right' }}>{t('home.transitDegree')}</Text>
          </View>
          {notableTransits.map((p) => (
            <Pressable key={p.body} style={styles.transitRow} onPress={() => setSelectedTransit(p)}>
              <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>{p.body}</Text>
              <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>{p.sign}</Text>
              <Text
                variant="bodySm"
                tone="muted"
                style={{ flex: 1, fontVariant: ['tabular-nums'], textAlign: 'right' }}
              >
                {degreeReadout(p.longitude)} {p.retrograde ? 'R' : ''}
              </Text>
              <ChevronRight size={14} color={color.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>
          ))}
        </Card>
      )}

      <Modal
        visible={!!selectedTransit}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTransit(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTransit(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selectedTransit && (
              <>
                <Text variant="label" tone="accent">{selectedTransit.body.toUpperCase()}</Text>
                <Text variant="title" weight="semibold" style={{ marginTop: 4 }}>
                  {selectedTransit.sign} {degreeReadout(selectedTransit.longitude)}
                </Text>
                <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>
                  {selectedTransit.retrograde
                    ? t('home.transitRetrograde', { body: selectedTransit.body })
                    : t('home.transitDirect', { body: selectedTransit.body })}
                </Text>
                <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
                  {t('home.transitNote')}
                </Text>
                <Button
                  label={t('common.close')}
                  variant="secondary"
                  onPress={() => setSelectedTransit(null)}
                  style={{ marginTop: spacing.lg }}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {astroProfile && (
        <Card
          elevated
          style={{ marginBottom: spacing.sm }}
          onPress={() => navigation.navigate('DailyHoroscope', { localDate: astrologyApi.todayLocalDate() })}
        >
          <View style={styles.cardHeaderRow}>
            <Text variant="label" tone="accent">{t('home.dailyGuidanceTitle')}</Text>
            <ChevronRight size={16} color={color.textMuted} />
          </View>
          {dailyHoroscope && (
            // Sourced from the horoscope's OWN localDate, not "today" -
            // this is the date the content was actually generated for, so
            // if a stale cached entry were ever shown, the label would
            // honestly reflect that instead of silently relabeling it as
            // today.
            <Text variant="caption" tone="muted" style={styles.guidanceDate}>
              {formatLongDate(dailyHoroscope.localDate)}
            </Text>
          )}
          {dailyHoroscope ? (
            <>
              <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{t('home.careerLabel')}</Text>
                {dailyHoroscope.careerGuidance}
              </Text>
              <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
                <Text variant="bodySm" weight="semibold">{t('home.relationshipsLabel')}</Text>
                {dailyHoroscope.relationshipGuidance}
              </Text>
              <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
                <Text variant="bodySm" weight="semibold">{t('home.energyLabel')}</Text>
                {dailyHoroscope.selfCarePrompt}
              </Text>
              <Text variant="caption" tone="accent" style={{ marginTop: spacing.sm }}>
                {t('home.tryTodayLabel')}{dailyHoroscope.focus.action}
              </Text>
            </>
          ) : (
            <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>
              {t('home.dailyGuidanceEmpty')}
            </Text>
          )}
        </Card>
      )}

      <Card elevated style={{ marginBottom: spacing.sm }}>
        <View style={styles.cardHeaderRow}>
          <Text variant="label" tone="accent">{t('home.feelingTitle')}</Text>
        </View>
        {todayMood ? (
          <Pressable
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

      <Card
        elevated
        style={{ marginBottom: spacing.sm }}
        onPress={() => navigation.navigate(latestPalmReading ? 'PalmHistory' : 'PalmIntro')}
      >
        <View style={styles.cardHeaderRow}>
          <Text variant="label" tone="accent">{t('home.palmInsightTitle')}</Text>
          <ChevronRight size={16} color={color.textMuted} />
        </View>
        {latestPalmReading === undefined ? (
          <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>{t('common.loading')}</Text>
        ) : latestPalmReading ? (
          <>
            <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm }}>
              {latestPalmReading.freeReading.summary}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              {t('home.palmInsightScanned', {
                date: new Date(latestPalmReading.createdAt).toLocaleDateString(),
                count: latestPalmReading.freeReading.sections.length,
              })}
            </Text>
          </>
        ) : (
          <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>
            {t('home.palmInsightEmpty')}
          </Text>
        )}
      </Card>

      <FadeDivider style={{ marginVertical: spacing.lg }} />

      <Card elevated onPress={() => navigation.navigate('Paywall')} style={styles.upgradeCard}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="accent">{t('home.premiumTitle')}</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
            {t('home.premiumDesc')}
          </Text>
        </View>
        <StatusBadge label={t('common.upgrade')} status="accent" />
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={t('home.exploreTitle')} />
        <View style={styles.grid}>
          {sections.map((s) => (
            <Card key={s.id} style={styles.tile} onPress={() => s.navigate(navigation)}>
              <View style={styles.tileTop}>
                <View style={styles.tileIcon}>
                  <s.icon size={18} color={color.accent} strokeWidth={1.75} />
                </View>
                {s.comingSoon && <StatusBadge label={t('common.comingSoon')} status="neutral" />}
              </View>
              <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{t(`home.sections.${s.id}.title`)}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t(`home.sections.${s.id}.description`)}</Text>
            </Card>
          ))}
        </View>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
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
  guidanceDate: {
    marginTop: 2,
  },
  dialSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  transitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: color.borderSubtle,
    marginBottom: 4,
  },
  transitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: color.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: color.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  upgradeCard: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
