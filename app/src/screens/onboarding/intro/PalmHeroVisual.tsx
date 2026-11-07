import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Hand } from 'lucide-react-native';
import { color, radius } from '../../../theme/tokens';

/**
 * Original vector composition (no photography) representing AI palm analysis:
 * an open-hand icon with fine curved "line" overlays suggesting heart/head/life
 * lines being traced. This project has no stock-photo or image-generation
 * pipeline wired up, so every intro hero is built from the existing design
 * system (gradients + icons + SVG) rather than a placeholder or broken URL.
 */
export function PalmHeroVisual({ size = 240 }: { size?: number }) {
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <LinearGradient
        colors={[color.surfaceElevated, color.surface]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path
          d={`M ${size * 0.28} ${size * 0.38} Q ${size * 0.5} ${size * 0.3} ${size * 0.78} ${size * 0.42}`}
          stroke={color.accent}
          strokeWidth={1.5}
          strokeOpacity={0.55}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M ${size * 0.26} ${size * 0.52} Q ${size * 0.52} ${size * 0.58} ${size * 0.76} ${size * 0.5}`}
          stroke={color.secondary}
          strokeWidth={1.5}
          strokeOpacity={0.5}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M ${size * 0.34} ${size * 0.68} Q ${size * 0.4} ${size * 0.5} ${size * 0.38} ${size * 0.3}`}
          stroke={color.highlight}
          strokeWidth={1.5}
          strokeOpacity={0.4}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.iconWrap}>
        <Hand size={size * 0.32} color={color.accent} strokeWidth={1.25} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 999,
    backgroundColor: color.accentMuted,
    opacity: 0.6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
