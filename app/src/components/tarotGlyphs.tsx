import React from 'react';
import { Path, Circle, G } from 'react-native-svg';
import {
  Feather, WandSparkles, Moon, Flower2, Crown, Key, Heart, Compass, Shield, Lamp, Orbit, Scale, Anchor, Hourglass,
  Droplets, Link2, Zap, Star, MoonStar, Sun, Bell, Globe, Sparkles, LucideIcon,
} from 'lucide-react-native';
import { Suit } from '../types/tarot';

/** One emblem per Major Arcana card (by number 0-21), so each of the 22 reads differently at a glance. */
export const MAJOR_EMBLEM: LucideIcon[] = [
  Feather, WandSparkles, Moon, Flower2, Crown, Key, Heart, Compass, Shield, Lamp, Orbit,
  Scale, Anchor, Hourglass, Droplets, Link2, Zap, Star, MoonStar, Sun, Bell, Globe,
];

export const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

export const RANK_COUNT: Record<string, number> = {
  ace: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
export const COURT_RANKS = ['page', 'knight', 'queen', 'king'];

/** Pip positions (0-1 box) for number cards, laid out like a classic deck. */
export function pipLayout(n: number): [number, number][] {
  const col = (x: number, count: number): [number, number][] =>
    Array.from({ length: count }, (_, i) => [x, count === 1 ? 0.5 : 0.12 + (0.76 * i) / (count - 1)]);
  switch (n) {
    case 1: return [[0.5, 0.5]];
    case 2: return col(0.5, 2);
    case 3: return col(0.5, 3);
    case 4: return [...col(0.3, 2), ...col(0.7, 2)];
    case 5: return [...col(0.3, 2), ...col(0.7, 2), [0.5, 0.5]];
    case 6: return [...col(0.3, 3), ...col(0.7, 3)];
    case 7: return [...col(0.3, 3), ...col(0.7, 3), [0.5, 0.3]];
    case 8: return [...col(0.3, 4), ...col(0.7, 4)];
    case 9: return [...col(0.3, 4), ...col(0.7, 4), [0.5, 0.5]];
    default: return [...col(0.3, 4), ...col(0.7, 4), [0.5, 0.28], [0.5, 0.72]];
  }
}

/** The four suit marks, drawn on a 24x24 grid so they stay crisp at any size. */
export function SuitGlyph({ suit, x, y, size, color }: { suit: Suit; x: number; y: number; size: number; color: string }) {
  const k = size / 24;
  const common = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <G transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`}>
      {suit === 'wands' && (
        <>
          <Path d="M12 2v20" {...common} />
          <Path d="M12 7c-3.5 0-5-2-5-4.5 3.5 0 5 2 5 4.5zM12 12c3.5 0 5-2 5-4.5-3.5 0-5 2-5 4.5z" {...common} fill={color} fillOpacity={0.35} />
        </>
      )}
      {suit === 'cups' && (
        <>
          <Path d="M5 4h14l-1.2 6.5a5.8 5.8 0 0 1-11.6 0L5 4z" {...common} fill={color} fillOpacity={0.3} />
          <Path d="M12 16.5V20M8 22h8" {...common} />
        </>
      )}
      {suit === 'swords' && (
        <>
          <Path d="M12 1.5l2.2 3.2v10.3H9.8V4.7L12 1.5z" {...common} fill={color} fillOpacity={0.3} />
          <Path d="M6.5 15h11M12 15v7.5" {...common} />
        </>
      )}
      {suit === 'pentacles' && (
        <>
          <Circle cx={12} cy={12} r={9.5} {...common} />
          <Path d="M12 4.5l2.1 6.2h6.4l-5.2 3.8 2 6.2L12 16.8l-5.3 3.9 2-6.2-5.2-3.8h6.4L12 4.5z" {...common} fill={color} fillOpacity={0.3} />
        </>
      )}
    </G>
  );
}

export { Sparkles };
