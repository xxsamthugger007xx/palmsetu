import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
}

/** The one big "do this next" card at the top of Home: bold, glowing, with a single clear action. */
export function HeroActionCard({ icon: Icon, title, description, cta, onPress, colors = ['#5B4BD6', '#2B2741'] }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${cta}`} onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.iconBadge}>
          <Icon size={26} color={color.onPrimary} strokeWidth={1.75} />
        </View>
        <Text variant="title" weight="semibold" tone="onPrimary" style={{ marginTop: spacing.md }}>{title}</Text>
        <Text variant="bodySm" style={styles.desc}>{description}</Text>
        <View style={styles.cta}>
          <Text variant="bodySm" weight="semibold" style={{ color: '#2B2741' }}>{cta}</Text>
          <ArrowRight size={16} color="#2B2741" strokeWidth={2} style={{ marginLeft: spacing.xs }} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, marginBottom: spacing.md },
  card: {
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
});
