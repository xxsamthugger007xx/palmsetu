import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { color, spacing } from '../theme/tokens';

interface Props {
  /** Current real stage label, e.g. "Accessing your Kundli..." - supplied
   * live by the caller as stage events arrive from the backend. Defaults to
   * a generic "Thinking..." when nothing more specific has resolved yet, or
   * when a stage resolved too quickly to be worth showing (see debounce
   * below). */
  label?: string;
}

/**
 * Compact "thinking" indicator shown inline in the assistant's chat bubble
 * while the real pipeline runs, before the first answer chunk arrives.
 * Deliberately small - a single row sized to roughly match a short chat
 * message, not a full overlay or illustration. Reuses the same small
 * gradient-orb visual language as FloatingAIButton.tsx, scaled down, with a
 * gentle opacity/scale pulse only (no rotating rings, no particles).
 *
 * By default this shows "Thinking...". A more specific stage label replaces
 * it, as a single line (never a list), only once that stage has stayed
 * current for a short debounce window (150ms) - a stage that resolves
 * faster than that (the common case for in-memory data lookups) never gets
 * its own visible transition, so nothing is narrated that isn't actually
 * taking long enough to be worth narrating. This component never paces or
 * delays the real pipeline - it is purely reactive to whatever label the
 * caller passes it.
 */
export function AIThinkingOverlay({ label }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [displayLabel, setDisplayLabel] = useState('Thinking...');
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    const appSub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => {
      sub?.remove?.();
      appSub.remove();
    };
  }, []);

  // Debounced label swap: a new label only takes effect if it stays current
  // for 150ms+ - fast-resolving stages are skipped entirely so the indicator
  // never flickers through narration for work that was effectively instant.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next = label && label.trim() ? label : 'Thinking...';
    if (next === displayLabel) return;
    debounceRef.current = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
        setDisplayLabel(next);
        Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      });
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  useEffect(() => {
    if (reduceMotion || !appActive) {
      pulse.stopAnimation();
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [reduceMotion, appActive]);

  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const orbOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <View style={styles.row}>
      <Animated.View style={{ transform: [{ scale: orbScale }], opacity: orbOpacity }}>
        <LinearGradient
          colors={[color.accent, color.highlight ?? '#D7C7FF', color.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orb}
        />
      </Animated.View>
      <Animated.View style={{ opacity: fade }}>
        <Text variant="body" tone="secondary" style={styles.label}>
          {displayLabel}
        </Text>
      </Animated.View>
    </View>
  );
}

const ORB_SIZE = 18;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    marginRight: spacing.sm,
  },
  label: {
    color: color.textSecondary,
  },
});
