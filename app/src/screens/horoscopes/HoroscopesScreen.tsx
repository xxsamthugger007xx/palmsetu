import React from 'react';
import { Sun } from 'lucide-react-native';
import { ComingSoonScreen } from '../../components/ComingSoonScreen';

/**
 * Browse-by-sign zodiac horoscopes (generic, not tied to the user's own
 * birth profile). No such backend capability exists yet - the only real
 * horoscope data today is the personalized daily reading in
 * DailyHoroscopeScreen, which is deliberately not reused here so this
 * placeholder never passes off personalized content as generic browsing.
 */
export function HoroscopesScreen() {
  return (
    <ComingSoonScreen
      icon={Sun}
      title="Zodiac Horoscopes"
      description="Browse horoscopes by zodiac sign, for anyone, anytime."
      note="General sign-by-sign horoscopes are planned but not built yet. In the meantime, your Daily Report gives you a personalized reading based on your own birth details."
    />
  );
}
