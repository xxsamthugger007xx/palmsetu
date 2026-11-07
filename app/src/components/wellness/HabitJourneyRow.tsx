import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../Text';
import { color, radius, spacing } from '../../theme/tokens';
import { buildWeeklyStreakDots } from '../../utils/wellnessCompute';

type Props = {
  name: string;
  completedToday: boolean;
  currentStreak: number;
  onToggle: () => void;
};

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A single habit's row in the home-screen "Habit journey" section: real
 * 7-day dot strip (see buildWeeklyStreakDots), real streak count, and a
 * one-tap complete-today toggle wired directly to the habit endpoints. */
export function HabitJourneyRow({ name, completedToday, currentStreak, onToggle }: Props) {
  const dots = buildWeeklyStreakDots(currentStreak, completedToday);
  // Align the 7-dot strip so the last dot is always "today".
  const todayIdx = new Date().getDay();
  const letters = Array.from({ length: 7 }, (_, i) => DAY_LETTERS[(todayIdx - 6 + i + 70) % 7]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={completedToday ? `Mark ${name} as not done today` : `Mark ${name} as done today`}
        style={[styles.checkbox, completedToday && styles.checkboxDone]}
      >
        {completedToday && <Check size={14} color={color.success} strokeWidth={2.5} />}
      </Pressable>

      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="bodySm" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
          {currentStreak > 0 && (
            <Text variant="caption" tone="accent" style={{ marginLeft: spacing.sm }}>
              {currentStreak} day{currentStreak === 1 ? '' : 's'}
            </Text>
          )}
        </View>
        <View style={styles.dotsRow}>
          {dots.map((done, i) => (
            <View key={i} style={styles.dotCol}>
              <View style={[styles.dot, done && styles.dotDone]} />
              <Text variant="caption" tone="muted" style={styles.dotLabel}>{letters[i]}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: { borderColor: color.success, backgroundColor: color.successMuted },
  dotsRow: { flexDirection: 'row', marginTop: spacing.xs },
  dotCol: { alignItems: 'center', marginRight: spacing.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.border,
  },
  dotDone: { backgroundColor: color.accent, borderColor: color.accent },
  dotLabel: { marginTop: 2, fontSize: 9 },
});
