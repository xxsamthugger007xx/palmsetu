import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { DailyHoroscope } from '../../types/astrology';
import { formatLongDate } from '../../utils/formatDate';
import { guidanceLeadsFor } from './homeSections';
import { useUserProfile } from '../../context/UserProfileContext';

/** Home card showing today's guidance (career / relationships / energy) from the daily horoscope. */
export function DailyGuidanceCard({ dailyHoroscope }: { dailyHoroscope: DailyHoroscope | null }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = useUserProfile();
  const lead = guidanceLeadsFor(profile?.focus);
  return (
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
                {(['career', 'relationships', 'energy'] as ('career' | 'relationships' | 'energy')[])
                  .sort((x, y) => (x === lead ? -1 : y === lead ? 1 : 0))
                  .map((line, i) => (
                    <Text key={line} variant="bodySm" tone="secondary" style={{ marginTop: i === 0 ? spacing.sm : spacing.xs }}>
                      <Text variant="bodySm" weight="semibold">{t(`home.${line}Label`)}</Text>
                      {line === 'career' ? dailyHoroscope.careerGuidance : line === 'relationships' ? dailyHoroscope.relationshipGuidance : dailyHoroscope.selfCarePrompt}
                    </Text>
                  ))}
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
  );
}

const styles = StyleSheet.create({
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guidanceDate: {
    marginTop: 2,
  },
});
