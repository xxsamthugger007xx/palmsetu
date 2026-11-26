import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, ChevronLeft, Heart, Wand2, History } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import { useTranslation } from 'react-i18next';
import { Image } from 'react-native';
import { SOULMATE_SKETCH_REGISTRY } from '../../data/soulmateSketchRegistry';

const SAMPLE_FILES = ['soulmate_001.jpg', 'soulmate_002.jpg', 'soulmate_003.jpg'];

const STEPS = [
  { icon: Heart, title: 'Share a few preferences', description: 'Gender, age range, cultural background and art style - nothing personal beyond that.' },
  { icon: Wand2, title: 'We match you to a hand-sketched portrait', description: 'A unique portrait from our illustrative sketch collection.' },
  { icon: Sparkles, title: 'Discover your compatibility reflection', description: 'A short personality and compatibility read, for fun and self-reflection.' },
];

export function SoulmateIntroScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const load = React.useCallback(async () => {
    soulmateApi.recordPageView();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const handlePrimaryCta = () => {
    navigation.navigate('SoulmateQuestionnaire', { intent: 'paid' });
  };

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <IconButton icon={History} onPress={() => navigation.navigate('SoulmateHistory')} />
      </View>

      <LinearGradient
        colors={[color.accentMuted, color.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.samples}>
          {SAMPLE_FILES.map((f, i) => (
            <Image
              key={f}
              source={SOULMATE_SKETCH_REGISTRY[f]}
              accessibilityLabel={t('soulmate.sampleLabel')}
              style={[styles.sample, i === 1 && styles.sampleCenter, { transform: [{ rotate: `${(i - 1) * 7}deg` }] }]}
            />
          ))}
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{t('soulmate.sampleLabel')}</Text>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {t('ui.SoulmateIntroScreen.soulmateSketch')}
        </Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
          {t('ui.SoulmateIntroScreen.aMysteriousArtisticPortraitOf')}
        </Text>
      </LinearGradient>

      <View style={{ marginTop: spacing.lg }}>
        {STEPS.map((step) => (
          <Card key={step.title} style={styles.stepCard}>
            <View style={styles.stepIcon}>
              <step.icon size={18} color={color.accent} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="bodySm" weight="semibold">{step.title}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{step.description}</Text>
            </View>
          </Card>
        ))}
      </View>

      <Button
        label="Explore Premium Sketches"
        icon={Sparkles}
        fullWidth
        style={{ marginTop: spacing.lg }}
        onPress={handlePrimaryCta}
      />

      <Text variant="caption" tone="muted" style={styles.finePrint}>
        {t('ui.SoulmateIntroScreen.soulmateSketchIsEntertainmentAnd')}
      </Text>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  samples: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 150 },
  sample: { width: 96, height: 124, borderRadius: radius.md, marginHorizontal: -8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: color.surface },
  sampleCenter: { width: 112, height: 144, zIndex: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.accentBorder,
    padding: spacing.xl,
    marginTop: spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finePrint: {
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
