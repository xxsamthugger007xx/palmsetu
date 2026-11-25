import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Sparkles } from 'lucide-react-native';
import { radius, typography } from '../theme/tokens';
import { tarotColor, cardGradient } from '../theme/tarotTheme';
import { Text } from './Text';
import { Orientation, Suit, TarotCard } from '../types/tarot';
import { MAJOR_EMBLEM, ROMAN, RANK_COUNT, COURT_RANKS, pipLayout, SuitGlyph } from './tarotGlyphs';

type Props = {
  card?: TarotCard;
  orientation?: Orientation;
  faceDown?: boolean;
  width?: number;
  height?: number;
  dimmed?: boolean;
};

const GOLD = tarotColor.gold;

/** Gold double frame with a small diamond in each corner - the "foil" edge shared by every card face. */
function Frame({ w, h }: { w: number; h: number }) {
  const m = Math.max(3, w * 0.045);
  const d = Math.max(2.5, w * 0.03);
  const corners: [number, number][] = [[m * 2, m * 2], [w - m * 2, m * 2], [m * 2, h - m * 2], [w - m * 2, h - m * 2]];
  return (
    <>
      <Rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} rx={w * 0.07} stroke={GOLD} strokeOpacity={0.85} strokeWidth={1.4} fill="none" />
      <Rect x={m * 1.9} y={m * 1.9} width={w - 3.8 * m} height={h - 3.8 * m} rx={w * 0.045} stroke={GOLD} strokeOpacity={0.35} strokeWidth={0.8} fill="none" />
      {corners.map(([cx, cy], i) => (
        <Path key={i} d={`M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z`} fill={GOLD} fillOpacity={0.9} />
      ))}
    </>
  );
}

/**
 * Original card artwork drawn in code (no reproduced deck): a gold foil frame, a Roman numeral, and a real picture for
 * every card - one emblem for each of the 22 Major Arcana, and classic pip layouts (1-10 suit marks) or a crowned suit
 * mark for the court cards in the Minor Arcana. Each suit keeps its own cosmic colour.
 */
export function TarotCardFace({ card, orientation = 'upright', faceDown, width = 120, height = 184, dimmed }: Props) {
  if (faceDown || !card) {
    return (
      <View style={[styles.base, { width, height }, dimmed && styles.dimmed]}>
        <LinearGradient colors={[tarotColor.violet, tarotColor.midnight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Frame w={width} h={height} />
            <Circle cx={width / 2} cy={height / 2} r={width * 0.27} stroke={GOLD} strokeOpacity={0.5} strokeWidth={1} fill="none" />
            <Circle cx={width / 2} cy={height / 2} r={width * 0.19} stroke={GOLD} strokeOpacity={0.3} strokeWidth={0.8} fill="none" />
          </Svg>
          <Sparkles size={width * 0.22} color={GOLD} strokeWidth={1.25} />
        </LinearGradient>
      </View>
    );
  }

  const isMajor = card.arcana === 'major';
  const suit = card.suit as Suit | null;
  const gradientKey: 'major' | Suit = isMajor ? 'major' : (suit as Suit);
  const isReversed = orientation === 'reversed';
  const rank = card.rank ?? '';
  const isCourt = COURT_RANKS.includes(rank);

  const artTop = height * 0.17;
  const artH = height * 0.58;
  const artW = width * 0.74;
  const artLeft = (width - artW) / 2;
  const cx = width / 2;
  const cy = artTop + artH / 2;
  const iconSize = width * 0.4;
  const MajorIcon = isMajor ? MAJOR_EMBLEM[Math.min(card.number ?? 0, 21)] : null;
  const label = isMajor ? ROMAN[Math.min(card.number ?? 0, 21)] : rank.toUpperCase();
  const pipSize = Math.min(artW * 0.26, artH * 0.2);

  return (
    <View style={[styles.base, { width, height }, dimmed && styles.dimmed]}>
      <LinearGradient
        colors={cardGradient[gradientKey]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, isReversed && styles.rotated]}
      >
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={GOLD} stopOpacity={0.38} />
              <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Frame w={width} h={height} />
          <Circle cx={cx} cy={cy} r={Math.min(artW, artH) * 0.62} fill="url(#halo)" />
          {isMajor && <Circle cx={cx} cy={cy} r={width * 0.27} stroke={GOLD} strokeOpacity={0.55} strokeWidth={1} fill="none" />}
          {!isMajor && suit && !isCourt &&
            pipLayout(RANK_COUNT[rank] ?? 1).map(([px, py], i) => (
              <SuitGlyph key={i} suit={suit} x={artLeft + px * artW} y={artTop + py * artH} size={RANK_COUNT[rank] === 1 ? pipSize * 2.4 : pipSize} color={GOLD} />
            ))}
          {!isMajor && suit && isCourt && (
            <>
              <Path
                d={`M${cx - width * 0.14} ${cy - artH * 0.3}l${width * 0.05} ${-artH * 0.1}l${width * 0.045} ${artH * 0.06}l${width * 0.045} ${-artH * 0.06}l${width * 0.05} ${artH * 0.1}z`}
                fill={GOLD} fillOpacity={0.9}
              />
              <SuitGlyph suit={suit} x={cx} y={cy + artH * 0.05} size={iconSize * 1.1} color={GOLD} />
            </>
          )}
        </Svg>

        {/* Major Arcana emblem (a real icon per card) sits above the drawn halo. */}
        {MajorIcon && (
          <View style={[styles.emblem, { top: cy - iconSize / 2, left: cx - iconSize / 2, width: iconSize, height: iconSize }]}>
            <MajorIcon size={iconSize} color={GOLD} strokeWidth={1.4} />
          </View>
        )}

        <Text variant="caption" style={[styles.numeral, { top: height * 0.06, color: GOLD, fontSize: Math.max(8, width * 0.1) }]}>{label}</Text>
        <Text
          variant="caption"
          numberOfLines={2}
          style={[styles.name, { bottom: height * 0.065, fontSize: Math.max(8, width * 0.095), lineHeight: Math.max(10, width * 0.115) }]}
        >
          {card.name}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  rotated: { transform: [{ rotate: '180deg' }] },
  dimmed: { opacity: 0.5 },
  emblem: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  numeral: { position: 'absolute', alignSelf: 'center', letterSpacing: 1.5, fontFamily: typography.fontFamily.semibold },
  name: {
    position: 'absolute',
    alignSelf: 'center',
    width: '86%',
    textAlign: 'center',
    color: tarotColor.lavender,
    fontFamily: typography.fontFamily.serif,
  },
});
