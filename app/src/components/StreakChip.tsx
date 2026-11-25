import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';

/** The daily streak as a small flame in the header: gold and lit when the streak is alive, grey when it hasn't started. */
export function StreakChip({ days, atRisk, onPress }: { days: number; atRisk?: boolean; onPress?: () => void }) {
  const { t } = useTranslation();
  const alive = days > 0;
  const still = useReduceMotion();
  const flick = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!alive || still) { flick.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flick, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flick, { toValue: 0, duration: 640, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [alive, still]);
  const tint = !alive ? color.textMuted : atRisk ? color.warning : color.gold;
  return (
    <View
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${days} ${t('streak.dayStreak')}`}
      hitSlop={10}
      onTouchEnd={onPress}
      style={[styles.chip, alive && { backgroundColor: color.goldMuted, borderColor: color.goldBorder }]}
    >
      <Animated.View style={{ transform: [{ scale: flick.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }, { rotate: flick.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '5deg'] }) }] }}>
        <Flame size={15} color={tint} strokeWidth={2} fill={alive ? tint : 'transparent'} />
      </Animated.View>
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
