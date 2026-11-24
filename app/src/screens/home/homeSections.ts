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

