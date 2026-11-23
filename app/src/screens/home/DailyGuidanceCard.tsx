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

/** Home card showing today's guidance (career / relationships / energy) from the daily horoscope. */
export function DailyGuidanceCard({ dailyHoroscope }: { dailyHoroscope: DailyHoroscope | null }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
