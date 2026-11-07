import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { color, radius } from '../../../theme/tokens';

/** Original vector composition: three fanned card shapes with the center card
 * elevated and glowing, echoing the app's existing TarotCardFace design
 * language rather than photographed tarot artwork. */
export function TarotHeroVisual({ size = 240 }: { size?: number }) {
  const cardWidth = size * 0.34;
  const cardHeight = size * 0.52;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <LinearGradient colors={[color.surfaceElevated, color.surface]} style={StyleSheet.absoluteFill} />
      <View style={styles.glow} />

      <View style={[styles.card, styles.sideCard, { width: cardWidth, height: cardHeight, transform: [{ rotate: '-14deg' }, { translateX: -cardWidth * 0.55 }] }]} />
      <View style={[styles.card, styles.sideCard, { width: cardWidth, height: cardHeight, transform: [{ rotate: '14deg' }, { translateX: cardWidth * 0.55 }] }]} />

      <View style={[styles.card, styles.centerCard, { width: cardWidth * 1.1, height: cardHeight * 1.1 }]}>
        <Sparkles size={cardWidth * 0.5} color={color.accent} strokeWidth={1.25} />
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
    width: '65%',
    height: '65%',
    borderRadius: 999,
    backgroundColor: color.accentMuted,
    opacity: 0.55,
  },
  card: {
    position: 'absolute',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  sideCard: {
    backgroundColor: color.surface,
    borderColor: color.border,
    opacity: 0.7,
  },
  centerCard: {
    backgroundColor: color.surface,
    borderColor: color.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: color.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});
