import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles, Flame, Droplet, Swords as SwordsIcon, Coins, LucideIcon,
} from 'lucide-react-native';
import { radius, spacing } from '../theme/tokens';
import { tarotColor, cardGradient } from '../theme/tarotTheme';
import { Text } from './Text';
import { Orientation, Suit, TarotCard } from '../types/tarot';

const suitIcon: Record<Suit, LucideIcon> = {
  wands: Flame,
  cups: Droplet,
  swords: SwordsIcon,
  pentacles: Coins,
};

type Props = {
  card?: TarotCard;
  orientation?: Orientation;
  faceDown?: boolean;
  width?: number;
  height?: number;
  dimmed?: boolean;
};

/** Original, non-copyrighted card visual: a premium gradient-and-typography
 * face built entirely from this design system (no reproduced artwork from
 * any real deck). Major Arcana and each Minor Arcana suit get their own
 * cosmic gradient (see theme/tarotTheme.ts) with a gold foil-style border,
 * standing in for real card illustrations until original artwork exists. */
export function TarotCardFace({ card, orientation = 'upright', faceDown, width = 120, height = 184, dimmed }: Props) {
  if (faceDown || !card) {
    return (
      <View style={[styles.base, { width, height }, dimmed && styles.dimmed]}>
        <LinearGradient
          colors={[tarotColor.violet, tarotColor.midnight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, styles.faceDownBorder]}
        >
          <View style={styles.faceDownOrnamentOuter}>
            <View style={styles.faceDownOrnamentInner}>
              <Sparkles size={width * 0.24} color={tarotColor.gold} strokeWidth={1.25} />
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const Icon = card.arcana === 'major' ? Sparkles : suitIcon[card.suit as Suit];
  const gradientKey: 'major' | Suit = card.arcana === 'major' ? 'major' : (card.suit as Suit);
  const isReversed = orientation === 'reversed';

  return (
    <View style={[styles.base, { width, height }, dimmed && styles.dimmed]}>
      <LinearGradient
        colors={cardGradient[gradientKey]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, styles.faceUpBorder, isReversed && styles.rotated]}
      >
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.numeral, { color: tarotColor.gold }, isReversed && styles.rotated]}
        >
          {card.arcana === 'major' ? String(card.number).padStart(2, '0') : card.rank?.toUpperCase()}
        </Text>
        <View style={styles.iconWrap}>
          <Icon size={width * 0.3} color={tarotColor.lavender} strokeWidth={1.5} />
        </View>
        <Text
          variant="caption"
          weight="semibold"
          tone="primary"
          style={[styles.name, isReversed && styles.rotated]}
          numberOfLines={2}
        >
          {card.name}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.lg,
  },
  faceDownBorder: {
    borderWidth: 1.5,
    borderColor: tarotColor.goldMuted,
    justifyContent: 'center',
  },
  faceUpBorder: {
    borderWidth: 1.5,
    borderColor: tarotColor.goldMuted,
  },
  faceDownOrnamentOuter: {
    width: '62%',
    height: '62%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceDownOrnamentInner: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  dimmed: {
    opacity: 0.5,
  },
  numeral: {
    alignSelf: 'flex-start',
    letterSpacing: 1,
  },
  iconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    textAlign: 'center',
  },
});
