import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { color } from '../theme/tokens';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Star = { x: number; y: number; size: number; gold: boolean; delay: number; period: number };

// A fixed pseudo-random sky (same every launch, so it never "jumps"), spread over a tall area.
function makeStars(count: number): Star[] {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: count }, () => ({
    x: rnd() * 100, y: rnd() * 100, size: 1.2 + rnd() * 2.6, gold: rnd() < 0.22, delay: rnd() * 2600, period: 1800 + rnd() * 2600,
  }));
}

function Twinkle({ star, still }: { star: Star; still: boolean }) {
  const o = useRef(new Animated.Value(still ? 0.65 : 0.2)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(star.delay),
        Animated.timing(o, { toValue: 1, duration: star.period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.15, duration: star.period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still]);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, borderRadius: star.size,
        backgroundColor: star.gold ? color.gold : '#ffffff', opacity: o,
        shadowColor: star.gold ? color.gold : '#fff', shadowOpacity: 0.9, shadowRadius: star.size * 2, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

/** A quietly twinkling night sky behind a screen. Decorative: ignores touches and holds still with "reduce motion". */
export function StarField({ count = 42 }: { count?: number }) {
  const still = useReduceMotion();
  const stars = useMemo(() => makeStars(count), [count]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {stars.map((s, i) => <Twinkle key={i} star={s} still={still} />)}
    </View>
  );
}
