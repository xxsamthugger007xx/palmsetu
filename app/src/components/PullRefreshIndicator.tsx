import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { color } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 44;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type RefreshPhase = 'idle' | 'pulling' | 'refreshing' | 'completed';

/**
 * Custom pull-to-refresh indicator: deep-purple glow badge with an SVG
 * progress ring, replacing the bare OS spinner. Driven by `progress`
 * (Animated.Value, 0 = not pulled, 1 = at/past the release threshold) for
 * the pulling state, and by `phase` for refreshing/completed.
 *
 * Left to the caller (PageContainer): the actual gesture/threshold
 * detection (native ScrollView + RefreshControl already does this
 * reliably, see PageContainer.tsx's own comments on why that was kept
 * rather than reimplemented) - this component only ever renders what it's
 * told, it never decides when a refresh starts or ends.
 */
// RN's Animated.Value and Animated.AnimatedInterpolation overload
// `.interpolate()` with incompatible generic signatures that TypeScript
// cannot unify under one prop type, even though both support the exact
// same `.interpolate({inputRange, outputRange, extrapolate})` call used
// below at runtime. Typed loosely here rather than fighting those
// overloads - this is a leaf UI component with a single, simple call site
// (PageContainer.tsx), not a public API surface worth over-engineering.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnimatedNumber = any;

export function PullRefreshIndicator({ progress, phase }: { progress: AnimatedNumber; phase: RefreshPhase }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // Continuous rotation while refreshing - stops immediately (not mid-spin
  // reset) once the phase changes, so it never looks like it's spinning
  // forever after data has already loaded.
  useEffect(() => {
    if (phase !== 'refreshing' || reduceMotion) {
      spin.stopAnimation();
      return;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, reduceMotion, spin]);

  useEffect(() => {
    if (phase === 'completed') {
      checkScale.setValue(0);
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }).start();
    }
  }, [phase, checkScale]);

  if (phase === 'idle') return null;

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Pulling: the ring fills proportionally to how far the user has pulled,
  // and the whole badge fades/scales in rather than snapping into view -
  // "a subtle scale and opacity transition" per the design spec.
  const pullOpacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const pullScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1], extrapolate: 'clamp' });
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.badge,
          phase === 'pulling'
            ? { opacity: pullOpacity, transform: [{ scale: pullScale }] }
            : { opacity: 1, transform: [{ scale: 1 }] },
        ]}
      >
        <LinearGradient
          colors={[color.accentMuted, color.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glow}
        />
        {phase === 'completed' ? (
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Check size={18} color={color.success} strokeWidth={2.5} />
          </Animated.View>
        ) : (
          <Animated.View style={phase === 'refreshing' ? { transform: [{ rotate }] } : undefined}>
            <Svg width={SIZE} height={SIZE}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={color.accentBorder}
                strokeWidth={STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={color.accent}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={phase === 'pulling' ? strokeDashoffset : CIRCUMFERENCE * 0.25}
              />
            </Svg>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.accentBorder,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
