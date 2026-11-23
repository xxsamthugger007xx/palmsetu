import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, ChevronLeft, Pencil, Heart, Wand2, History, Gift } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import { SoulmateSketch } from '../../types/soulmate';
import { useTranslation } from 'react-i18next';

const STEPS = [
  { icon: Heart, title: 'Share a few preferences', description: 'Gender, age range, cultural background and art style - nothing personal beyond that.' },
  { icon: Wand2, title: 'We match you to a hand-sketched portrait', description: 'A unique portrait from our illustrative sketch collection.' },
  { icon: Sparkles, title: 'Discover your compatibility reflection', description: 'A short personality and compatibility read, for fun and self-reflection.' },
];

export function SoulmateIntroScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loaded, setLoaded] = useState(false);
  const [eligible, setEligible] = useState(true);
  const [freeSketch, setFreeSketch] = useState<SoulmateSketch | null>(null);

  const load = React.useCallback(async () => {
    soulmateApi.recordPageView();
    try {
      const status = await soulmateApi.getTrialStatus();
      setEligible(status.eligible);
      setFreeSketch(status.freeSketch);
    } catch {
      // If the check itself fails, default to eligible rather than blocking
      // a brand-new user from ever seeing the free-trial CTA - the real
      // enforcement happens again server-side on creation regardless.
      setEligible(true);
      setFreeSketch(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const handlePrimaryCta = () => {
    if (eligible) {
      navigation.navigate('SoulmateQuestionnaire', { intent: 'free' });
      return;
    }
    if (freeSketch && freeSketch.generationStatus !== 'completed') {
      // An existing free sketch that never finished (still generating, or
      // failed) - resume/retry it directly rather than starting over.
      navigation.navigate('SoulmateGenerating', { sketchId: freeSketch.id });
      return;
    }
    navigation.navigate('SoulmateQuestionnaire', { intent: 'paid' });
  };

  const ctaLabel = eligible
    ? 'Create My Free Sketch'
    : freeSketch && freeSketch.generationStatus !== 'completed'
      ? 'Continue your sketch'
      : 'Explore Premium Sketches';

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
        <View style={styles.heroIcon}>
          <Pencil size={26} color={color.accent} strokeWidth={1.5} />
        </View>
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

      <Card style={{ marginTop: spacing.md }}>
        <Text variant="caption" tone="muted">
          {t('ui.SoulmateIntroScreen.soulmateSketchIsEntertainmentAnd')}
        </Text>
      </Card>

      {loaded && (
        eligible ? (
          <Card elevated style={styles.trialBanner}>
            <Gift size={16} color={color.success} strokeWidth={1.75} />
            <Text variant="bodySm" weight="semibold" tone="success" style={{ marginLeft: spacing.sm }}>
              {t('ui.SoulmateIntroScreen.yourFirstSoulmateSketchIs')}
            </Text>
          </Card>
        ) : (
          freeSketch?.generationStatus === 'completed' && (
            <Card style={styles.usedBanner}>
              <Text variant="bodySm" tone="secondary">
                {t('ui.SoulmateIntroScreen.yourFreeSketchHasBeen')}
              </Text>
            </Card>
          )
        )
      )}

      <Button
        label={ctaLabel}
        icon={eligible ? Gift : Sparkles}
        fullWidth
        disabled={!loaded}
        style={{ marginTop: spacing.md }}
        onPress={handlePrimaryCta}
      />

      {!eligible && freeSketch?.generationStatus === 'completed' && (
        <Button
          label={t('ui.SoulmateIntroScreen.viewMyFreeSketch')}
          variant="secondary"
          fullWidth
          style={{ marginTop: spacing.sm }}
          onPress={() => navigation.navigate('SoulmateResult', { sketchId: freeSketch.id })}
        />
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
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
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    borderColor: color.successMuted,
  },
  usedBanner: {
    marginTop: spacing.lg,
  },
});
