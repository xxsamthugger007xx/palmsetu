import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '../theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Four stylised palm lines on a 100x127 canvas, in the order the screen "finds" them. Decorative only: it shows that
// the photo is being studied, not where the real lines were detected.
const LINES: { d: string; stroke: string; length: number }[] = [
  { d: 'M16 48 C34 38 58 38 84 46', stroke: color.accent, length: 80 },       // heart
  { d: 'M16 62 C38 60 60 64 80 72', stroke: color.secondary, length: 80 },    // head
  { d: 'M34 36 C20 62 24 92 44 108', stroke: color.gold, length: 90 },        // life
  { d: 'M54 112 C52 90 52 70 56 48', stroke: color.highlight, length: 70 },   // fate
];

/** Palm lines that draw themselves one after another, in a loop, over the palm photo while it is being analysed. */
export function PalmLinesOverlay({ activeIndex }: { activeIndex?: number }) {
  const progress = useRef(LINES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        ...progress.map((p) => Animated.timing(p, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: false })),
        Animated.delay(500),
        Animated.parallel(progress.map((p) => Animated.timing(p, { toValue: 0, duration: 400, useNativeDriver: false }))),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 127" preserveAspectRatio="none">
      {LINES.map((l, i) => (
        <AnimatedPath
          key={i}
          d={l.d}
          stroke={l.stroke}
          strokeWidth={activeIndex === i ? 2.6 : 1.8}
          strokeLinecap="round"
          fill="none"
          strokeOpacity={0.95}
          strokeDasharray={`${l.length}`}
          strokeDashoffset={progress[i].interpolate({ inputRange: [0, 1], outputRange: [l.length, 0] })}
        />
      ))}
    </Svg>
  );
}
