import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';
import { StreakSummary } from '../services/streakApi';

/** The daily streak: big number, last-7-days dots, and one honest line about where things stand. */
export function StreakCard({ streak, onRemindersPress }: { streak: StreakSummary; onRemindersPress?: () => void }) {
  const { t } = useTranslation();
  const alive = streak.current > 0;
  const message = streak.milestone
    ? t('streak.milestone', { n: streak.milestone })
    : streak.atRisk
      ? t('streak.atRisk')
      : alive
        ? t('streak.checkedIn')
        : t('streak.start');

  return (
    <Card
      elevated
      accessible
      accessibilityLabel={`${streak.current} ${t('streak.dayStreak')}. ${message}`}
      style={{ marginBottom: spacing.sm }}
    >
      <View style={styles.row}>
        <Flame size={28} color={alive ? color.accent : color.textMuted} strokeWidth={1.75} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <View style={styles.numberRow}>
            <Text variant="title" weight="semibold">{streak.current}</Text>
            <Text variant="bodySm" tone="secondary" style={{ marginLeft: spacing.xs }}>{t('streak.dayStreak')}</Text>
          </View>
          <Text variant="caption" tone="muted">{t('streak.longest', { n: streak.longest })}</Text>
        </View>
        <View style={styles.dots}>
          {streak.week.map((d, i) => (
            <View key={d.date} style={[styles.dot, d.done && styles.dotDone, i === streak.week.length - 1 && styles.dotToday]} />
          ))}
        </View>
      </View>
      <Text
        variant="caption"
        weight={alive ? 'semibold' : 'regular'}
        tone={streak.atRisk ? 'warning' : alive ? 'success' : 'secondary'}
        style={{ marginTop: spacing.sm }}
      >
        {message}
      </Text>
      {onRemindersPress && (
        <Text variant="caption" tone="accent" weight="semibold" accessibilityRole="button" onPress={onRemindersPress} style={{ marginTop: spacing.xs }}>
          {t('streak.turnOnReminders')}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.border },
  dotDone: { backgroundColor: color.accent },
  dotToday: { borderWidth: 1.5, borderColor: color.accentBorder },
});
