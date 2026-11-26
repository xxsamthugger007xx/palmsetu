import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import { color } from '../theme/tokens';
import { Text } from './Text';
import { useReduceMotion } from '../hooks/useReduceMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type DialMarker = {
  /** 0-360, a real ecliptic-longitude-derived angle. */
  angleDeg: number;
  /** short label shown nowhere on the dial itself, kept for key/accessibility only. */
  key: string;
  /** emphasised (larger, accent-2) vs a regular scattered point. */
  emphasis?: boolean;
};

type Props = {
  size?: number;
  label: string;
  readout: string;
  statusLine?: string;
  /** 0-360, rotates a single plotted marker point to represent a real position (e.g. moon longitude-derived angle). Omitted entirely in the empty state. */
  markerAngleDeg?: number;
  /** Multiple scattered points (e.g. several real transiting bodies), each at its own angle and radius band so they don't overlap. Takes priority over markerAngleDeg when provided. */
  markers?: DialMarker[];
};

/**
 * The Observatory signature hero: a circular instrument dial with an outer
 * degree ring, a radial tick-mark ring at 30-degree intervals, an inner
 * solid disc, and a centered tabular-numeral readout. Used on the Home
 * screen and reused (smaller) wherever a single-value "live instrument"
 * reading is appropriate.
 */
export function InstrumentDial({ size = 220, label, readout, statusLine, markerAngleDeg, markers }: Props) {
  const r = size / 2;
  const outerR = r - 4;
  const tickOuter = r - 10;
  const tickInner = r - 20;
  const discR = r - 32;
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  const still = useReduceMotion();
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    // A very slow continuous sweep - purely cosmetic (every marker keeps its
    // real angle relative to every other marker and to the tick ring, since
    // they all rotate together), just makes the instrument feel alive
    // rather than a frozen diagram.
    const spin = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 90000, easing: Easing.linear, useNativeDriver: true }),
    );
    // Not native-driven: this animates an SVG circle's radius/opacity, which
    // react-native-svg's native props bridge doesn't support on the native
    // animated driver (unlike plain RN style transforms, used by `spin`
    // above). JS-driven is the correct choice here, not a workaround.
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    spin.start();
    breathe.start();
    return () => { spin.stop(); breathe.stop(); };
  }, [still]);

  const rotateDeg = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={outerR} stroke={color.border} strokeWidth={1} fill="none" />
        <Circle cx={r} cy={r} r={discR} fill={color.surface} stroke={color.borderSubtle} strokeWidth={1} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotateDeg }] }]}>
        <Svg width={size} height={size}>
          <G>
            {ticks.map((deg) => {
              const rad = toRad(deg);
              const x1 = r + tickInner * Math.cos(rad);
              const y1 = r + tickInner * Math.sin(rad);
              const x2 = r + tickOuter * Math.cos(rad);
              const y2 = r + tickOuter * Math.sin(rad);
              return (
                <Line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={color.textMuted}
                  strokeWidth={deg % 90 === 0 ? 1.5 : 1}
                />
              );
            })}
            {markers
              ? markers.map((m, i) => {
                  // Stagger the radius band by index so same-angle/near-angle real
                  // points (e.g. two transiting bodies in the same sign) don't
                  // visually collide, matching the reference's scattered layout.
                  const band = (discR + 10) + (i % 3) * 8;
                  const rad = toRad(m.angleDeg);
                  const cx = r + band * Math.cos(rad);
                  const cy = r + band * Math.sin(rad);
                  return m.emphasis ? (
                    <AnimatedCircle
                      key={m.key}
                      cx={cx}
                      cy={cy}
                      r={Animated.multiply(pulseScale, 5) as unknown as number}
                      fill={color.accent}
                      opacity={pulseOpacity as unknown as number}
                    />
                  ) : (
                    <Circle key={m.key} cx={cx} cy={cy} r={3} fill={color.accent2} />
                  );
                })
              : typeof markerAngleDeg === 'number' && (
                  <AnimatedCircle
                    cx={r + (discR + 6) * Math.cos(toRad(markerAngleDeg))}
                    cy={r + (discR + 6) * Math.sin(toRad(markerAngleDeg))}
                    r={Animated.multiply(pulseScale, 4) as unknown as number}
                    fill={color.accent}
                    opacity={pulseOpacity as unknown as number}
                  />
                )}
          </G>
        </Svg>
      </Animated.View>
      <View style={styles.center} pointerEvents="none">
        <Text variant="label" tone="secondary">{label}</Text>
        <Text
          variant="display"
          weight="semibold"
          style={{ fontVariant: ['tabular-nums'], marginTop: 2 }}
        >
          {readout}
        </Text>
        {statusLine ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{statusLine}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
