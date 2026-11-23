import React from 'react';
import { Rocket } from 'lucide-react-native';
import { ComingSoonScreen } from '../../components/ComingSoonScreen';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder for an extended horoscope experience beyond the personalized
 * Daily Report and generic sign-browsing Horoscopes section (weekly/monthly
 * outlooks, deeper transit breakdowns, etc). No distinct backend capability
 * for this exists yet beyond what Daily Report and Horoscopes already cover.
 */
export function HoroscopeLauncherScreen() {
  const { t } = useTranslation();
  return (
    <ComingSoonScreen
      icon={Rocket}
      title={t('ui.HoroscopeLauncherScreen.extendedHoroscopes')}
      description={t('ui.HoroscopeLauncherScreen.deeperOutlooksBeyondTodayWeekly')}
      note="This extended experience is planned but not built yet. Your Daily Report and Zodiac Horoscopes already cover today's guidance."
    />
  );
}
