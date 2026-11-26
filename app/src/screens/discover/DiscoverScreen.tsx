import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Sparkles, Sun, Users, Compass as CompassIcon, Gem, ArrowRight, ChevronRight, Layers } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { FadeInUp } from '../../components/FadeInUp';
import { SectionHeader } from '../../components/SectionHeader';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { color, radius, spacing } from '../../theme/tokens';
import { discoverModules } from '../../data/mock';
import { RootStackParamList } from '../../navigation/types';

const MODULE_I18N_KEY: Record<string, string> = {
  horoscope: 'horoscope',
  compatibility: 'compatibility',
  vastu: 'vastu',
  'self-discovery': 'selfDiscovery',
  gemstone: 'gemstone',
};

const iconFor: Record<string, typeof Sparkles> = {
  tarot: Layers,
  astrology: Sparkles,
  horoscope: Sun,
  compatibility: Users,
  vastu: CompassIcon,
  'self-discovery': CompassIcon,
  gemstone: Gem,
};

/** Each module's own mood - a gradient pair for the two hero tiles, a
 * matching tint for the smaller tiles' icon badges. Gives the grid real
 * visual variety instead of one flat purple repeated everywhere. */
const TINT: Record<string, { solid: string; soft: string; gradient: [string, string] }> = {
  tarot: { solid: '#A78BFA', soft: 'rgba(167, 139, 250, 0.16)', gradient: ['#8A5CD6', '#3A2A6B'] },
  astrology: { solid: '#5EC8E5', soft: 'rgba(94, 200, 229, 0.16)', gradient: ['#3F8FBF', '#1E3A52'] },
  horoscope: { solid: '#E8B85C', soft: 'rgba(232, 184, 92, 0.16)', gradient: ['#C99A3E', '#5A451C'] },
  compatibility: { solid: '#F08DB5', soft: 'rgba(240, 141, 181, 0.16)', gradient: ['#D1699A', '#4A2638'] },
  vastu: { solid: '#7BD3A1', soft: 'rgba(123, 211, 161, 0.16)', gradient: ['#4FA87A', '#1F3B2C'] },
  'self-discovery': { solid: '#9184d9', soft: 'rgba(145, 132, 217, 0.16)', gradient: ['#6E5FBF', '#2B2741'] },
  gemstone: { solid: '#E7A98C', soft: 'rgba(231, 169, 140, 0.16)', gradient: ['#C77F5E', '#4A2E22'] },
};

export function DiscoverScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tarot, astrology, ...rest] = discoverModules;
  const mediums = rest.filter((m) => m.size === 'medium');
  const smalls = rest.filter((m) => m.size === 'small');

  return (
    <PageContainer onRefresh={async () => {}}>
      <FadeInUp>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('discover.title')}</Text>
        <Text variant="bodySm" tone="secondary" style={styles.subtitle}>
          Every reading, one tap away.
        </Text>
      </FadeInUp>

      <FadeInUp delay={80}>
        <HeroTile
          module={{ ...tarot, title: t('discover.tarotTitle'), description: t('discover.tarotDesc') }}
          onPress={() => navigation.navigate('TarotLanding')}
        />
      </FadeInUp>
      <FadeInUp delay={150}>
        <HeroTile
          module={{ ...astrology, title: t('discover.astrologyTitle'), description: t('discover.astrologyDesc') }}
          onPress={() => navigation.navigate('AstrologyLanding')}
        />
      </FadeInUp>

      <FadeInUp delay={220}>
        <View style={{ marginTop: spacing.md }}>
          <SectionHeader title="More to explore" />
        </View>
        <View style={styles.row}>
          {mediums.map((m) => (
            <FeatureCard
              key={m.id}
              module={{
                ...m,
                title: t(`discover.modules.${MODULE_I18N_KEY[m.id]}.title`),
                description: t(`discover.modules.${MODULE_I18N_KEY[m.id]}.description`),
              }}
              style={{ flex: 1 }}
              onPress={() => (m.id === 'vastu' ? navigation.navigate('VastuLanding') : undefined)}
            />
          ))}
        </View>
      </FadeInUp>

      <FadeInUp delay={280}>
        <View style={styles.row}>
          {smalls.map((m) => (
            <FeatureCard
              key={m.id}
              module={{
                ...m,
                title: t(`discover.modules.${MODULE_I18N_KEY[m.id]}.title`),
                description: t(`discover.modules.${MODULE_I18N_KEY[m.id]}.description`),
              }}
              style={{ flex: 1 }}
              compact
              onPress={() => {
                if (m.id === 'compatibility') navigation.navigate('SoulmateIntro');
                else if (m.id === 'gemstone') navigation.navigate('GemstoneLanding');
              }}
            />
          ))}
        </View>
      </FadeInUp>
    </PageContainer>
  );
}

/** The two headline tiles (Tarot, Astrology): full gradient in the
 * module's own mood, a floating icon badge, and a light that glides across
 * every few seconds - same visual language as Home's HeroActionCard, so
 * the two biggest features on the app feel like the main event here too. */
function HeroTile({
  module,
  onPress,
}: {
  module: (typeof discoverModules)[number];
  onPress?: () => void;
}) {
  const Icon = iconFor[module.id] ?? Sparkles;
  const tint = TINT[module.id] ?? TINT.tarot;
  const still = useReduceMotion();
  const shine = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    const shineLoop = Animated.loop(Animated.sequence([
      Animated.delay(2400),
      Animated.timing(shine, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    shineLoop.start();
    floatLoop.start();
    return () => { shineLoop.stop(); floatLoop.stop(); };
  }, [still]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${module.title}. ${module.description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.heroWrap, pressed && { opacity: 0.92 }]}
    >
      <LinearGradient colors={tint.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Animated.View
            style={[
              styles.heroIconBadge,
              { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
            ]}
          >
            <Icon size={24} color="#ffffff" strokeWidth={1.75} />
          </Animated.View>
          <View style={styles.heroArrow}>
            <ArrowRight size={16} color="#ffffff" strokeWidth={2} />
          </View>
        </View>
        <Text variant="title" weight="semibold" tone="onPrimary" style={{ marginTop: spacing.md }}>
          {module.title}
        </Text>
        <Text variant="bodySm" style={styles.heroDesc}>{module.description}</Text>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: -20, bottom: -20, width: 90,
            transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { rotate: '16deg' }],
            opacity: shine.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
          }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

function FeatureCard({
  module,
  compact,
  style,
  onPress,
}: {
  module: (typeof discoverModules)[number];
  compact?: boolean;
  style?: object;
  onPress?: () => void;
}) {
  const Icon = iconFor[module.id] ?? Sparkles;
  const tint = TINT[module.id] ?? TINT.tarot;
  return (
    <Card elevated style={[styles.card, style]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: tint.soft }]}>
          <Icon size={16} color={tint.solid} strokeWidth={1.75} />
        </View>
        <ChevronRight size={14} color={color.textMuted} />
      </View>
      <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>
        {module.title}
      </Text>
      {!compact && (
        <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {module.description}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    marginBottom: spacing.md,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: color.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.82)',
    marginTop: spacing.xs,
  },
});
