import {
  ScanLine, Layers, Sparkles, Moon, Sun, Heart, Rocket, Hash, MessageCircle,
  FolderClock, LucideIcon, PenLine,
} from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';

export type NotableTransit = { body: string; sign: string; longitude: number; retrograde: boolean };

export function timeOfDayGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'common.greetingMorning';
  if (hour < 18) return 'common.greetingAfternoon';
  return 'common.greetingEvening';
}

export type SectionCard = {
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
export const sections: SectionCard[] = [
  {
    id: 'palm',
    icon: ScanLine,
    // Routes through the Palm hub, not straight to the intro flow - the hub
    // already knows whether a profile exists and branches correctly (view
    // the existing report + confirmed "scan another" vs. a genuine
    // first-time intro). Going straight to PalmIntro here used to skip that
    // check entirely: tapping this tile with an existing profile would run
    // the whole capture/analyze flow only to have the backend reject the
    // duplicate and silently fall back to the OLD reading (see
    // PalmAnalyzingScreen's PROFILE_EXISTS handling) - this looked like
    // "my new scan did nothing, the old one came back."
    navigate: (nav) => nav.navigate('PalmScan' as never),
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
    id: 'lovetest',
    icon: Heart,
    navigate: (nav) => nav.navigate('Relationships'),
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


/** Which Explore tiles best serve each focus area; tiles for what someone picked float to the top, the rest keep their order. */
const FOCUS_TILES: Record<string, string[]> = {
  love: ['lovetest', 'tarot', 'astrology'],
  career: ['dailyreport', 'astrology', 'palm'],
  money: ['dailyreport', 'astrology', 'palm'],
  health: ['dailyreport', 'moonsign'],
  family: ['lovetest', 'astrology'],
  growth: ['aichat', 'palm', 'tarot'],
};

export function orderSectionsForFocus(list: SectionCard[], focus: string[] | undefined): SectionCard[] {
  if (!focus || focus.length === 0) return list;
  const rank = new Map<string, number>();
  focus.forEach((f, fi) => (FOCUS_TILES[f] ?? []).forEach((id, i) => { if (!rank.has(id)) rank.set(id, fi * 10 + i); }));
  return [...list].sort((a, b) => (rank.get(a.id) ?? 1000) - (rank.get(b.id) ?? 1000));
}

/** Which of today's guidance lines (career / relationships / energy) should lead for these focus areas. */
export function guidanceLeadsFor(focus: string[] | undefined): 'career' | 'relationships' | 'energy' | null {
  const first = focus?.[0];
  if (!first) return null;
  if (first === 'career' || first === 'money') return 'career';
  if (first === 'love' || first === 'family') return 'relationships';
  return 'energy';
}
