import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';

/** The daily streak as a small flame in the header: gold and lit when the streak is alive, grey when it hasn't started. */
export function StreakChip({ days, atRisk, onPress }: { days: number; atRisk?: boolean; onPress?: () => void }) {
  const { t } = useTranslation();
  const alive = days > 0;
  const tint = !alive ? color.textMuted : atRisk ? color.warning : color.gold;
  return (
    <View
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${days} ${t('streak.dayStreak')}`}
      onTouchEnd={onPress}
      style={[styles.chip, alive && { backgroundColor: color.goldMuted, borderColor: color.goldBorder }]}
    >
      <Flame size={15} color={tint} strokeWidth={2} fill={alive ? tint : 'transparent'} />
      <Text variant="bodySm" weight="semibold" style={{ color: tint, marginLeft: 4 }}>{days}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    marginRight: spacing.xs,
  },
});
