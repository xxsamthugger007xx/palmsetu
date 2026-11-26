import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon, ArrowRight } from 'lucide-react-native';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
  /** Two gradient stops; each feature gets its own mood (palm = warm gold, tarot = violet). */
  colors?: [string, string];
  /** A smaller, lower-profile layout: smaller icon badge, no separate
   * description line (folded inline next to the title instead), a compact
   * icon-only arrow instead of a full pill CTA. Same glow/shine/float
   * animation, just less visual weight - for when this card shouldn't
   * dominate the screen. */
  compact?: boolean;
}

/** The one big "do this next" card at the top of Home: bold, glowing, with a single clear action. */
export function HeroActionCard({ icon: Icon, title, description, cta, onPress, colors = ['#5B4BD6', '#2B2741'], compact }: Props) {
  const still = useReduceMotion();
  const shine = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const shineLoop = Animated.loop(Animated.sequence([
      Animated.delay(2600),
      Animated.timing(shine, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    shineLoop.start(); floatLoop.start();
    return () => { shineLoop.stop(); floatLoop.stop(); };
  }, [still]);
  if (compact) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${cta}`} onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardCompact}>
          <Animated.View style={[styles.iconBadgeSmall, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]}>
            <Icon size={18} color={color.onPrimary} strokeWidth={1.75} />
          </Animated.View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="bodySm" weight="semibold" tone="onPrimary">{title}</Text>
            <Text variant="caption" style={styles.descCompact} numberOfLines={1}>{description}</Text>
          </View>
          <View style={styles.ctaCompact}>
            <ArrowRight size={14} color="#2B2741" strokeWidth={2.25} />
          </View>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: -20, bottom: -20, width: 70,
              transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-100, 360] }) }, { rotate: '16deg' }],
              opacity: shine.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.8, 0.8, 0] }),
            }}
          >
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${cta}`} onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <Animated.View style={[styles.iconBadge, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}>
          <Icon size={26} color={color.onPrimary} strokeWidth={1.75} />
        </Animated.View>
        <Text variant="title" weight="semibold" tone="onPrimary" style={{ marginTop: spacing.md }}>{title}</Text>
        <Text variant="bodySm" style={styles.desc}>{description}</Text>
        <View style={styles.cta}>
          <Text variant="bodySm" weight="semibold" style={{ color: '#2B2741' }}>{cta}</Text>
          <ArrowRight size={16} color="#2B2741" strokeWidth={2} style={{ marginLeft: spacing.xs }} />
        </View>
        {/* A soft light that glides across the card every few seconds. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: -20, bottom: -20, width: 90,
            transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { rotate: '16deg' }],
            opacity: shine.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
          }}
        >
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, marginBottom: spacing.md },
  card: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: color.primary,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  iconBadge: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  desc: { color: 'rgba(255,255,255,0.82)', marginTop: spacing.xs },
  cta: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: spacing.md,
    backgroundColor: '#ffffff', borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.md,
  },
  cardCompact: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: color.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconBadgeSmall: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  descCompact: { color: 'rgba(255,255,255,0.78)', marginTop: 1 },
  ctaCompact: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff', marginLeft: spacing.sm,
  },
});
