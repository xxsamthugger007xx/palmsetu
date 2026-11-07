import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Polygon, Rect, Circle, Text as SvgText, G } from 'react-native-svg';
import { color } from '../../theme/tokens';
import { KundliChartData, KundliChartStyle } from '../../types/kundli';

const SIGN_ABBR = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];
const PLANET_ABBR: Record<string, string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

/** Groups planets by their whole-sign house number (1-12) for placing
 * abbreviated labels inside each house wedge/box. Real placements only -
 * never fabricated positions. */
function byHouse(data: KundliChartData): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const p of data.placements) {
    out[p.house] = out[p.house] ?? [];
    out[p.house].push(PLANET_ABBR[p.planet] ?? p.planet.slice(0, 2));
  }
  return out;
}

/** North India style: a diamond divided into 12 house wedges (4 outer
 * triangles + 4 corner squares forming the classic kundli diamond). House 1
 * (the ascendant) is always the top-center wedge, fixed by convention;
 * sign/planet labels are placed per the real whole-sign house assignment. */
function NorthIndiaChart({ data, size }: { data: KundliChartData; size: number }) {
  const s = size;
  const houses = byHouse(data);
  // 12 label anchor points (approximate wedge centers) for a standard diamond layout.
  const anchors: { house: number; x: number; y: number }[] = [
    { house: 1, x: s * 0.5, y: s * 0.22 },
    { house: 2, x: s * 0.26, y: s * 0.1 },
    { house: 3, x: s * 0.1, y: s * 0.26 },
    { house: 4, x: s * 0.22, y: s * 0.5 },
    { house: 5, x: s * 0.1, y: s * 0.74 },
    { house: 6, x: s * 0.26, y: s * 0.9 },
    { house: 7, x: s * 0.5, y: s * 0.78 },
    { house: 8, x: s * 0.74, y: s * 0.9 },
    { house: 9, x: s * 0.9, y: s * 0.74 },
    { house: 10, x: s * 0.78, y: s * 0.5 },
    { house: 11, x: s * 0.9, y: s * 0.26 },
    { house: 12, x: s * 0.74, y: s * 0.1 },
  ];
  return (
    <Svg width={s} height={s}>
      <Rect x={1} y={1} width={s - 2} height={s - 2} stroke={color.border} strokeWidth={1.5} fill={color.surface} />
      <Line x1={0} y1={0} x2={s} y2={s} stroke={color.borderSubtle} strokeWidth={1} />
      <Line x1={s} y1={0} x2={0} y2={s} stroke={color.borderSubtle} strokeWidth={1} />
      <Polygon points={`${s / 2},0 ${s},${s / 2} ${s / 2},${s} 0,${s / 2}`} stroke={color.border} strokeWidth={1.5} fill="none" />
      {anchors.map(({ house, x, y }) => (
        <G key={house}>
          <SvgText x={x} y={y - 6} fontSize={9} fill={color.textMuted} textAnchor="middle">{house}</SvgText>
          <SvgText x={x} y={y + 8} fontSize={9} fill={color.accent} textAnchor="middle">
            {(houses[house] ?? []).join(' ')}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

/** South India style: fixed 4x4 box grid (12 outer cells used, center 2x2
 * left empty) where each cell is a FIXED zodiac sign (Aries top-left-ish by
 * convention), so planets are placed by their real sidereal sign, not by
 * house number. */
function SouthIndiaChart({ data, size }: { data: KundliChartData; size: number }) {
  const s = size;
  const cell = s / 4;
  // Fixed sign->grid-cell mapping for the standard South Indian layout
  // (signs run clockwise from the top-left cell, skipping the center 2x2).
  const cellForSignIndex: [number, number][] = [
    [0, 0], [1, 0], [2, 0], [3, 0],
    [3, 1], [3, 2], [3, 3], [2, 3],
    [1, 3], [0, 3], [0, 2], [0, 1],
  ];
  const planetsBySign: Record<number, string[]> = {};
  for (const p of data.placements) {
    planetsBySign[p.signIndex] = planetsBySign[p.signIndex] ?? [];
    planetsBySign[p.signIndex].push(PLANET_ABBR[p.planet] ?? p.planet.slice(0, 2));
  }
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (r > 0 && r < 3 && c > 0 && c < 3) continue; // center is empty
      cells.push({ r, c });
    }
  }
  return (
    <Svg width={s} height={s}>
      {cells.map(({ r, c }) => {
        const signIndex = cellForSignIndex.findIndex(([cc, rr]) => cc === c && rr === r);
        const labels = signIndex >= 0 ? planetsBySign[signIndex] ?? [] : [];
        return (
          <G key={`${r}-${c}`}>
            <Rect x={c * cell} y={r * cell} width={cell} height={cell} stroke={color.border} strokeWidth={1} fill={color.surface} />
            {signIndex >= 0 && (
              <SvgText x={c * cell + 4} y={r * cell + 12} fontSize={8} fill={color.textMuted}>{SIGN_ABBR[signIndex]}</SvgText>
            )}
            <SvgText x={c * cell + cell / 2} y={r * cell + cell / 2 + 10} fontSize={9} fill={color.accent} textAnchor="middle">
              {labels.join(' ')}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** Western style: a circular wheel, 12 sign segments, with real planet
 * placements marked at their sidereal longitude (adapted from the same ring
 * treatment as ZodiacWheel.tsx). */
function WesternChart({ data, size }: { data: KundliChartData; size: number }) {
  const r = size / 2;
  const outerR = r - 4;
  const signRingR = r - 22;
  const innerR = r - 40;
  const planetR = r - 56;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={outerR} stroke={color.border} strokeWidth={1} fill="none" />
      <Circle cx={r} cy={r} r={innerR} stroke={color.borderSubtle} strokeWidth={1} fill={color.surface} />
      {SIGN_ABBR.map((abbr, i) => {
        const segStart = i * 30;
        const lineRad = toRad(segStart);
        const labelRad = toRad(segStart + 15);
        return (
          <G key={abbr}>
            <Line
              x1={r + innerR * Math.cos(lineRad)} y1={r + innerR * Math.sin(lineRad)}
              x2={r + outerR * Math.cos(lineRad)} y2={r + outerR * Math.sin(lineRad)}
              stroke={color.borderSubtle} strokeWidth={1}
            />
            <SvgText x={r + signRingR * Math.cos(labelRad)} y={r + signRingR * Math.sin(labelRad) + 3} fontSize={8} fill={color.textMuted} textAnchor="middle">
              {abbr}
            </SvgText>
          </G>
        );
      })}
      {data.placements.map((p) => {
        const rad = toRad(p.siderealLongitude);
        const x = r + planetR * Math.cos(rad);
        const y = r + planetR * Math.sin(rad);
        return (
          <SvgText key={p.planet} x={x} y={y} fontSize={9} fill={color.accent} textAnchor="middle">
            {PLANET_ABBR[p.planet] ?? p.planet.slice(0, 2)}
          </SvgText>
        );
      })}
      {/* Ascendant marker line */}
      <Line
        x1={r} y1={r}
        x2={r + outerR * Math.cos(toRad(data.ascendantSiderealLongitude))}
        y2={r + outerR * Math.sin(toRad(data.ascendantSiderealLongitude))}
        stroke={color.accent} strokeWidth={1.5}
      />
    </Svg>
  );
}

type Props = { style: KundliChartStyle; data: KundliChartData; size?: number };

export function KundliChartSvg({ style, data, size = 260 }: Props) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {style === 'northIndia' && <NorthIndiaChart data={data} size={size} />}
      {style === 'southIndia' && <SouthIndiaChart data={data} size={size} />}
      {style === 'western' && <WesternChart data={data} size={size} />}
    </View>
  );
}
