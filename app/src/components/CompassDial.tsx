import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Polygon, G } from 'react-native-svg';
import { color } from '../theme/tokens';
import { DIRECTION_ORDER } from '../utils/compass';

type Props = {
  heading: number; // 0-359, 0 = North
  size?: number;
};

const DEFAULT_SIZE = 260;

/** The dial face (tick marks + direction labels) never changes shape - only
 * its rotation does, which is applied by the parent <G>. Memoizing this
 * separately means a heading update only touches the G's rotation prop
 * instead of re-creating ~32 SVG child elements every frame. */
const DialFace = memo(function DialFace({ size }: { size: number }) {
  const center = size / 2;
  const radius = size / 2 - 24;
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15); // every 15 degrees

  return (
    <>
      {ticks.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const isMajor = deg % 45 === 0;
        const outer = radius + 10;
        const inner = isMajor ? radius - 6 : radius;
        const x1 = center + outer * Math.sin(rad);
        const y1 = center - outer * Math.cos(rad);
        const x2 = center + inner * Math.sin(rad);
        const y2 = center - inner * Math.cos(rad);
        return (
          <Line
            key={deg}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isMajor ? color.accent : color.border}
            strokeWidth={isMajor ? 2 : 1}
          />
        );
      })}

      {DIRECTION_ORDER.map((dir, i) => {
        const deg = i * 45;
        const rad = (deg * Math.PI) / 180;
        const labelRadius = radius - 24;
        const x = center + labelRadius * Math.sin(rad);
        const y = center - labelRadius * Math.cos(rad);
        return (
          <SvgText
            key={dir}
            x={x} y={y + 5}
            fontSize={dir.length === 1 ? 16 : 12}
            fontWeight={dir === 'N' ? 'bold' : '600'}
            fill={dir === 'N' ? color.accent : color.textPrimary}
            textAnchor="middle"
          >
            {dir}
          </SvgText>
        );
      })}
    </>
  );
});

/** Visual compass dial - rotates the dial face under a fixed top-pointing
 * needle (the conventional "heading up" compass UI), so North visually moves
 * to wherever the device is actually pointing. Heading is rounded to whole
 * degrees before rendering: sub-degree jitter from the sensor would otherwise
 * trigger a re-render on every single reading for no visible benefit. */
export const CompassDial = memo(function CompassDial({ heading, size = DEFAULT_SIZE }: Props) {
  const center = size / 2;
  const radius = size / 2 - 24;
  const rotation = -Math.round(heading);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius + 14} fill={color.surfaceElevated} stroke={color.border} strokeWidth={1} />

        <G rotation={rotation} origin={`${center}, ${center}`}>
          <DialFace size={size} />
        </G>

        {/* Fixed needle pointing up, representing the device's current facing direction */}
        <Polygon
          points={`${center},${center - radius + 2} ${center - 7},${center + 10} ${center + 7},${center + 10}`}
          fill={color.accent}
        />
        <Circle cx={center} cy={center} r={5} fill={color.accent} />
      </Svg>
    </View>
  );
});
