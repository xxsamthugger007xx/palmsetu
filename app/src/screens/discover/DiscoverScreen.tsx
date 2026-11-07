import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Sparkles, Sun, Users, Compass as CompassIcon, Gem, ChevronRight, Layers } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { color, radius, spacing } from '../../theme/tokens';
import { discoverModules } from '../../data/mock';
import { RootStackParamList } from '../../navigation/types';

const iconFor: Record<string, typeof Sparkles> = {
  tarot: Layers,
  astrology: Sparkles,
  horoscope: Sun,
  compatibility: Users,
  vastu: CompassIcon,
  'self-discovery': CompassIcon,
  gemstone: Gem,
};

export function DiscoverScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tarot, astrology, ...rest] = discoverModules;
  const mediums = rest.filter((m) => m.size === 'medium');
  const smalls = rest.filter((m) => m.size === 'small');

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('discover.title')}</Text>

      <FeatureCard
        module={{ ...tarot, title: t('discover.tarotTitle'), description: t('discover.tarotDesc') }}
        large
        onPress={() => navigation.navigate('TarotLanding')}
      />
      <FeatureCard
        module={{ ...astrology, title: t('discover.astrologyTitle'), description: t('discover.astrologyDesc') }}
        large
        onPress={() => navigation.navigate('AstrologyLanding')}
      />

      <View style={styles.row}>
        {mediums.map((m) => (
          <FeatureCard
            key={m.id}
            module={m}
            style={{ flex: 1 }}
            onPress={() => (m.id === 'vastu' ? navigation.navigate('VastuLanding') : undefined)}
          />
        ))}
      </View>

      <View style={styles.row}>
        {smalls.map((m) => (
          <FeatureCard
            key={m.id}
            module={m}
            style={{ flex: 1 }}
            compact
            onPress={() => {
              if (m.id === 'compatibility') navigation.navigate('SoulmateQuiz');
              else if (m.id === 'gemstone') navigation.navigate('GemstoneLanding');
            }}
          />
        ))}
      </View>
    </PageContainer>
  );
}

function FeatureCard({
  module,
  large,
  compact,
  style,
  onPress,
}: {
  module: (typeof discoverModules)[number];
  large?: boolean;
  compact?: boolean;
  style?: object;
  onPress?: () => void;
}) {
  const Icon = iconFor[module.id] ?? Sparkles;
  return (
    <Card elevated={large} style={[styles.card, large && styles.cardLarge, style]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Icon size={large ? 20 : 16} color={color.accent} strokeWidth={1.75} />
        </View>
        {large && <ChevronRight size={16} color={color.textMuted} />}
      </View>
      <Text variant={large ? 'subtitle' : 'bodySm'} weight="semibold" style={{ marginTop: spacing.sm }}>
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardLarge: {
    paddingVertical: spacing.lg,
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
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
