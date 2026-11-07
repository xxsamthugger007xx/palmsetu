import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { color } from '../theme/tokens';
import { Text } from './Text';

type Props = {
  size?: number;
  strokeWidth?: number;
  /** 0..1 real progress ratio - never a decorative/fake value. */
  progress: number;
  trackColor?: string;
  progressColor?: string;
  children?: React.ReactNode;
};

/**
 * Minimal circular progress indicator, built on the same react-native-svg
 * primitives and center-overlay layout pattern as InstrumentDial.tsx (the
 * app's established precedent for radial instruments) rather than a new
 * technique. Pure presentation - callers compute the real ratio.
 */
export function ProgressRing({ size = 200, strokeWidth = 14, progress, trackColor, progressColor, children }: Props) {
  const r = size / 2;
  const radius = r - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * (1 - clamped);

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={r} originY={r}>
          <Circle
            cx={r}
            cy={r}
            r={radius}
            stroke={trackColor ?? color.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={r}
            cy={r}
            r={radius}
            stroke={progressColor ?? color.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {children ? (
        <View style={styles.center} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

/** Small convenience variant with a tabular-numeral "x / y" readout centered in the ring. */
export function CountProgressRing({ size = 200, strokeWidth = 14, completed, total, progressColor, label }: {
  size?: number; strokeWidth?: number; completed: number; total: number; progressColor?: string; label?: string;
}) {
  const ratio = total > 0 ? completed / total : 0;
  return (
    <ProgressRing size={size} strokeWidth={strokeWidth} progress={ratio} progressColor={progressColor}>
      <Text variant="display" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {completed}/{total}
      </Text>
      {label ? <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{label}</Text> : null}
    </ProgressRing>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
