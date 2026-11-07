import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ScanLine, Layers, Sparkles, Moon, Sun, Heart, Rocket, Hash, MessageCircle,
  FolderClock, LucideIcon,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { AppHeader } from '../../components/AppHeader';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { StatusBadge } from '../../components/StatusBadge';
import { FadeDivider } from '../../components/FadeDivider';
import { InstrumentDial } from '../../components/InstrumentDial';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useUserProfile } from '../../context/UserProfileContext';
import { astrologyApi } from '../../services/astrologyApi';
import { BirthProfile, DailyHoroscope } from '../../types/astrology';
import { degreeReadout } from '../../utils/astrology';

function timeOfDayGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

type SectionCard = {
  id: string;
  title: string;
  description: string;
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
    title: 'Hand Analysis',
    description: 'AI palmistry from a photo of your palm',
    icon: ScanLine,
    navigate: (nav) => nav.navigate('PalmIntro'),
  },
  {
    id: 'tarot',
    title: 'Tarot',
    description: 'Draw cards and reflect on your path',
    icon: Layers,
    navigate: (nav) => nav.navigate('TarotLanding'),
  },
  {
    id: 'astrology',
    title: 'Astrology',
    description: 'Vedic kundli and cosmic guidance',
    icon: Sparkles,
    navigate: (nav) => nav.navigate('AstrologyLanding'),
  },
  {
    id: 'moonsign',
    title: 'Moon Sign',
    description: 'Your sidereal and tropical moon sign',
    icon: Moon,
    navigate: (nav) => nav.navigate('MoonSign'),
  },
  {
    id: 'dailyreport',
    title: 'Daily Report',
    description: "Today's personalized guidance",
    icon: Sun,
    navigate: (nav) => nav.navigate('DailyHoroscope', { localDate: astrologyApi.todayLocalDate() }),
  },
  {
    id: 'horoscopes',
    title: 'Horoscopes',
    description: 'Zodiac horoscopes, by sign',
    icon: Sun,
    comingSoon: true,
    navigate: (nav) => nav.navigate('Horoscopes'),
  },
  {
    id: 'lovetest',
    title: 'Love Test',
    description: 'Connect with a partner for shared readings',
    icon: Heart,
    navigate: (nav) => nav.navigate('Relationships'),
  },
  {
    id: 'horoscopelauncher',
    title: 'Extended Horoscopes',
    description: 'Weekly and monthly outlooks',
    icon: Rocket,
    comingSoon: true,
    navigate: (nav) => nav.navigate('HoroscopeLauncher'),
  },
  {
    id: 'numerology',
    title: 'Numerology',
    description: 'Moolaank and Bhagyank',
    icon: Hash,
    comingSoon: true,
    navigate: (nav) => nav.navigate('Numerology'),
  },
  {
    id: 'western',
    title: 'Western Astrology',
    description: 'Tropical sun, moon and transits',
    icon: Sun,
    navigate: (nav) => nav.navigate('WesternAstrology'),
  },
  {
    id: 'aichat',
    title: 'AI Chat Assistant',
    description: 'Ask about any of your readings',
    icon: MessageCircle,
    navigate: (nav) => nav.navigate('AssistantChat', undefined),
  },
  {
    id: 'myreports',
    title: 'My Reports',
    description: 'All your previous readings, in one place',
    icon: FolderClock,
    navigate: (nav) => nav.navigate('MyReports'),
  },
];

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useUserProfile();
  const [astroProfile, setAstroProfile] = React.useState<BirthProfile | null>(null);
  const [dailyHoroscope, setDailyHoroscope] = React.useState<DailyHoroscope | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      astrologyApi
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
    }, [])
  );

  const moonTransit = dailyHoroscope?.transitContext.planets.find((p) => p.body === 'Moon');
  const notableTransits = dailyHoroscope?.transitContext.planets.filter((p) =>
    ['Sun', 'Moon', 'Mars', 'Venus', 'Jupiter'].includes(p.body)
  ) ?? [];

  if (!profile) return null; // navigator guards this, but keeps TS happy

  return (
    <PageContainer>
      <AppHeader greeting={t(timeOfDayGreetingKey())} name={profile.name} gender={profile.gender} hasNotifications />

      <View style={styles.dialSection}>
        {astroProfile && moonTransit ? (
          <InstrumentDial
            label="Moon tonight"
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
            label="Moon"
            readout={astroProfile.natal.moonSignSidereal}
            statusLine={`${astroProfile.natal.moonNakshatra} · Pada ${astroProfile.natal.moonNakshatraPada}`}
            markerAngleDeg={(astroProfile.natal.moonNakshatraPada - 1) * 90}
          />
        ) : (
          <InstrumentDial label="Moon" readout="- -" statusLine="Add your birth details to calibrate" />
        )}
        {!astroProfile && (
          <Text
            variant="bodySm"
            tone="accent"
            style={{ marginTop: spacing.sm }}
            onPress={() => navigation.navigate('AstrologyProfileSetup')}
          >
            Set up your profile
          </Text>
        )}
      </View>

      {notableTransits.length > 0 && (
        <Card style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>TODAY'S TRANSITS</Text>
          <View style={styles.transitHeaderRow}>
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>BODY</Text>
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>SIGN</Text>
            <Text variant="caption" tone="muted" style={{ flex: 1, textAlign: 'right' }}>DEGREE</Text>
          </View>
          {notableTransits.map((p) => (
            <View key={p.body} style={styles.transitRow}>
              <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>{p.body}</Text>
              <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>{p.sign}</Text>
              <Text
                variant="bodySm"
                tone="muted"
                style={{ flex: 1, fontVariant: ['tabular-nums'], textAlign: 'right' }}
              >
                {degreeReadout(p.longitude)} {p.retrograde ? 'R' : ''}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {dailyHoroscope && (
        <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.sm }}>
          {dailyHoroscope.focus.action}
        </Text>
      )}

      <FadeDivider style={{ marginVertical: spacing.lg }} />

      <Card elevated onPress={() => navigation.navigate('Paywall')} style={styles.upgradeCard}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="accent">SOLUNE PREMIUM</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
            Unlock deeper reports and unlimited AI chat
          </Text>
        </View>
        <StatusBadge label="Upgrade" status="accent" />
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Explore" />
        <View style={styles.grid}>
          {sections.map((s) => (
            <Card key={s.id} style={styles.tile} onPress={() => s.navigate(navigation)}>
              <View style={styles.tileTop}>
                <View style={styles.tileIcon}>
                  <s.icon size={18} color={color.accent} strokeWidth={1.75} />
                </View>
                {s.comingSoon && <StatusBadge label="Soon" status="neutral" />}
              </View>
              <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{s.title}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{s.description}</Text>
            </Card>
          ))}
        </View>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
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
