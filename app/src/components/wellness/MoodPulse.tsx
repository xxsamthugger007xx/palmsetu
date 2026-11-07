import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../Text';
import { color, radius, spacing } from '../../theme/tokens';
import { MoodLevel } from '../../services/wellnessApi';

const MOOD_LEVELS: { value: MoodLevel; label: string; tone: string; fill: number }[] = [
  { value: 'low', label: 'Low', tone: color.danger, fill: 0.35 },
  { value: 'down', label: 'Down', tone: color.warning, fill: 0.55 },
  { value: 'okay', label: 'Okay', tone: color.secondary, fill: 0.7 },
  { value: 'good', label: 'Good', tone: color.accent, fill: 0.85 },
  { value: 'great', label: 'Great', tone: color.accent2, fill: 1 },
];

/**
 * Non-emoji mood "pulse" marks: a filled circle per level whose radius
 * scales with the level's position on the scale. Used both as the
 * selectable row on this card and (read-only) as the "already checked in"
 * indicator - never an emoji face, per the product's no-emoji-heavy rule.
 */
function MoodMark({ tone, fill, size, selected }: { tone: string; fill: number; size: number; selected?: boolean }) {
  const r = (size / 2) * fill;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill={selected ? tone : 'transparent'}
        stroke={tone}
        strokeWidth={selected ? 0 : 1.5}
        opacity={selected ? 1 : 0.6}
      />
    </Svg>
  );
}

export function MoodPulseSelector({ value, onSelect }: { value: MoodLevel | null; onSelect: (m: MoodLevel) => void }) {
  return (
    <View style={styles.row}>
      {MOOD_LEVELS.map((m) => {
        const selected = value === m.value;
        return (
          <Pressable key={m.value} onPress={() => onSelect(m.value)} style={styles.item} hitSlop={6}>
            <View style={[styles.markWrap, selected && { backgroundColor: color.surfaceHover, borderColor: m.tone }]}>
              <MoodMark tone={m.tone} fill={m.fill} size={28} selected={selected} />
            </View>
            <Text variant="caption" tone={selected ? 'primary' : 'muted'} weight={selected ? 'semibold' : 'regular'} style={{ marginTop: 4 }}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Read-only summary mark for "already checked in today" states. */
export function MoodMarkBadge({ mood, size = 36 }: { mood: MoodLevel; size?: number }) {
  const def = MOOD_LEVELS.find((m) => m.value === mood) ?? MOOD_LEVELS[2];
  return (
    <View style={[styles.badgeWrap, { width: size + 8, height: size + 8, borderColor: def.tone }]}>
      <MoodMark tone={def.tone} fill={def.fill} size={size} selected />
    </View>
  );
}

export function moodLabel(mood: MoodLevel): string {
  return MOOD_LEVELS.find((m) => m.value === mood)?.label ?? mood;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center', flex: 1 },
  markWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceHover,
  },
});
