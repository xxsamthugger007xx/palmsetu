import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Animated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';

interface Props {
  onPress: () => void;
  /** Extra offset above the default resting position, e.g. to clear a tab bar. */
  bottomOffset?: number;
}

/**
 * Premium floating "Ask AI" orb, fixed bottom-right. A single reusable
 * component mounted once by the root navigator (see RootNavigator.tsx),
 * never duplicated per-screen. Visibility/positioning per screen is decided
 * by the caller, not by this component.
 */
export function FloatingAIButton({ onPress, bottomOffset = 0 }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const breathe = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    const appSub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => {
      sub?.remove?.();
      appSub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !appActive) {
      breathe.stopAnimation();
      breathe.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, appActive]);

  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: spacing.xl + bottomOffset }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(pressScale, { toValue: 0.92, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
        accessibilityRole="button"
        accessibilityLabel="Ask the AI Astrologer"
        accessibilityHint="Opens the AI assistant chat"
        hitSlop={8}
        style={styles.row}
      >
        <View style={styles.pill}>
          <Text variant="caption" weight="semibold" style={{ color: color.textPrimary }}>Ask AI</Text>
        </View>

        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />
          <LinearGradient
            colors={[color.accent, color.highlight ?? '#D7C7FF', color.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orb}
          >
            <Sparkles size={22} color={color.bg} strokeWidth={2} />
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const ORB_SIZE = 56;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 50,
    elevation: 50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.accentBorder,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: color.accent,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  glow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: (ORB_SIZE + 12) / 2,
    backgroundColor: color.accent,
  },
});
