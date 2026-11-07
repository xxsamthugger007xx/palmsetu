import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { color } from '../theme/tokens';

const SIGN_ABBR = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];

type Point = { label: string; sign: string };

type Props = {
  size?: number;
  /** Points to plot on the ring, placed at the center of their zodiac sign's 30deg segment. Real data only - never fabricated positions. */
  points: Point[];
};

/**
 * A natal-wheel-style diagram: an outer ring divided into the 12 zodiac
 * sign segments (house-division look, Observatory treatment) with
 * abbreviated sign labels, and real data points placed in their sign's
 * segment. This is a sign-level placement (the app's engine does not
 * expose exact longitude for most of these fields), not a precise-degree
 * ephemeris chart.
 */
export function ZodiacWheel({ size = 220, points }: Props) {
  const r = size / 2;
  const outerR = r - 4;
  const signRingR = r - 24;
  const innerR = r - 44;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const signIndex = (sign: string) => SIGN_ABBR.findIndex((a) => sign.toLowerCase().startsWith(a.toLowerCase()));

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G>
          <Circle cx={r} cy={r} r={outerR} stroke={color.border} strokeWidth={1} fill="none" />
          <Circle cx={r} cy={r} r={innerR} stroke={color.borderSubtle} strokeWidth={1} fill={color.surface} />
          {SIGN_ABBR.map((abbr, i) => {
            const segStart = i * 30;
            const lineRad = toRad(segStart);
            const labelRad = toRad(segStart + 15);
            return (
              <G key={abbr}>
                <Line
                  x1={r + innerR * Math.cos(lineRad)}
                  y1={r + innerR * Math.sin(lineRad)}
                  x2={r + outerR * Math.cos(lineRad)}
                  y2={r + outerR * Math.sin(lineRad)}
                  stroke={color.borderSubtle}
                  strokeWidth={1}
                />
                <SvgText
                  x={r + signRingR * Math.cos(labelRad)}
                  y={r + signRingR * Math.sin(labelRad) + 3}
                  fontSize={9}
                  fill={color.textMuted}
                  textAnchor="middle"
                >
                  {abbr}
                </SvgText>
              </G>
            );
          })}
          {points.map((p, i) => {
            const idx = signIndex(p.sign);
            if (idx < 0) return null;
            const rad = toRad(idx * 30 + 15);
            const pr = innerR + 8;
            return (
              <G key={p.label + i}>
                <Circle
                  cx={r + pr * Math.cos(rad)}
                  cy={r + pr * Math.sin(rad)}
                  r={5}
                  fill={color.accent}
                />
                <SvgText
                  x={r + (pr + 12) * Math.cos(rad)}
                  y={r + (pr + 12) * Math.sin(rad) + 3}
                  fontSize={9}
                  fill={color.accent2}
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
