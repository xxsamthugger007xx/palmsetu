import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Sparkles, Flame, Droplet, Swords as SwordsIcon, Coins, LucideIcon,
} from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
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

/** Original, non-copyrighted card visual: a restrained abstract face built from the
 * existing design system (icon + typography), not reproduced artwork from any deck. */
export function TarotCardFace({ card, orientation = 'upright', faceDown, width = 120, height = 184, dimmed }: Props) {
  if (faceDown || !card) {
    return (
      <View style={[styles.base, styles.faceDown, { width, height }, dimmed && styles.dimmed]}>
        <Sparkles size={width * 0.22} color={color.accent} strokeWidth={1.25} />
      </View>
    );
  }

  const Icon = card.arcana === 'major' ? Sparkles : suitIcon[card.suit as Suit];
  const isReversed = orientation === 'reversed';

  return (
    <View
      style={[
        styles.base,
        styles.faceUp,
        { width, height },
        isReversed && styles.rotated,
        dimmed && styles.dimmed,
      ]}
    >
      <Text variant="caption" tone="muted" style={styles.numeral}>
        {card.arcana === 'major' ? String(card.number).padStart(2, '0') : card.rank?.toUpperCase()}
      </Text>
      <View style={styles.iconWrap}>
        <Icon size={width * 0.3} color={color.accent} strokeWidth={1.5} />
      </View>
      <Text variant="caption" weight="semibold" style={styles.name} numberOfLines={2}>
        {card.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  faceDown: {
    backgroundColor: color.surfaceElevated,
    borderColor: color.border,
  },
  faceUp: {
    backgroundColor: color.surface,
    borderColor: color.accentBorder,
    justifyContent: 'space-between',
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  dimmed: {
    opacity: 0.5,
  },
  numeral: {
    alignSelf: 'flex-start',
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
