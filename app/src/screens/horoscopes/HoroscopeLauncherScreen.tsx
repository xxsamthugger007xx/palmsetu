import React from 'react';
import { Rocket } from 'lucide-react-native';
import { ComingSoonScreen } from '../../components/ComingSoonScreen';

/**
 * Placeholder for an extended horoscope experience beyond the personalized
 * Daily Report and generic sign-browsing Horoscopes section (weekly/monthly
 * outlooks, deeper transit breakdowns, etc). No distinct backend capability
 * for this exists yet beyond what Daily Report and Horoscopes already cover.
 */
export function HoroscopeLauncherScreen() {
  return (
    <ComingSoonScreen
      icon={Rocket}
      title="Extended Horoscopes"
      description="Deeper outlooks beyond today, weekly and monthly views, and more."
      note="This extended experience is planned but not built yet. Your Daily Report and Zodiac Horoscopes already cover today's guidance."
    />
  );
}
