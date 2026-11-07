import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { Text } from '../Text';
import { CountProgressRing } from '../ProgressRing';
import { color, radius, spacing } from '../../theme/tokens';
import { DailyResetProgress } from '../../utils/wellnessCompute';

type Props = {
  progress: DailyResetProgress;
  name?: string;
};

/**
 * The home screen's hero instrument: a real radial progress ring showing
 * "completed / total" daily activities (see utils/wellnessCompute.ts for
 * the exact, honestly-computed definition), with three adaptive copy
 * states - zero done (encouraging), mid-progress, and all done
 * (celebratory). The completion state plays a one-shot scale+fade pulse,
 * gated by AccessibilityInfo.isReduceMotionEnabled exactly like
 * FloatingAIButton.tsx already does.
 */
export function DailyResetHero({ progress, name }: Props) {
  const { completed, total, ratio } = progress;
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const wasComplete = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    const isComplete = total > 0 && completed === total;
    if (isComplete && !wasComplete.current && !reduceMotion) {
      pulse.setValue(0);
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]).start();
    }
    wasComplete.current = isComplete;
  }, [completed, total, reduceMotion]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  const state: 'start' | 'mid' | 'done' = total === 0 ? 'mid' : completed === 0 ? 'start' : completed === total ? 'done' : 'mid';

  const headline = state === 'done'
    ? 'Today is fully reset'
    : state === 'start'
      ? (name ? `Ready when you are, ${name}` : 'Ready when you are')
      : 'Good progress today';

  const subtext = state === 'done'
    ? 'Every reset you planned for today is done. Come back tomorrow for a fresh set.'
    : state === 'start'
      ? `${total} small ${total === 1 ? 'step' : 'steps'} make up today's reset.`
      : `${total - completed} more ${total - completed === 1 ? 'step' : 'steps'} left today.`;

  return (
    <LinearGradient
      colors={[color.surfaceElevated, color.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.ringCol}>
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
        <CountProgressRing
          size={132}
          strokeWidth={11}
          completed={completed}
          total={total}
          label="today"
          progressColor={state === 'done' ? color.success : color.accent}
        />
      </View>
      <View style={styles.textCol}>
        <View style={styles.badge}>
          {state === 'done' ? <Sparkles size={12} color={color.success} strokeWidth={2} /> : null}
          <Text variant="label" tone={state === 'done' ? 'success' : 'accent'} style={{ marginLeft: state === 'done' ? 4 : 0 }}>
            Daily reset
          </Text>
        </View>
        <Text variant="title" weight="semibold" style={{ marginTop: 4 }}>{headline}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: 4 }}>{subtext}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
  },
  ringCol: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: color.success,
  },
  textCol: { flex: 1, marginLeft: spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center' },
});
