import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Hand, ScanEye, Sparkles, MessageCircleQuestion, ShieldCheck, ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { FadeInUp } from '../../components/FadeInUp';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const steps = [
  { icon: ScanEye, title: 'Capture', description: 'Photograph your palm in good lighting', tint: color.accent, tintMuted: color.accentMuted },
  { icon: Sparkles, title: 'Detect', description: 'We identify visible lines and regions', tint: color.gold, tintMuted: color.goldMuted },
  { icon: MessageCircleQuestion, title: 'Reflect', description: 'Get a traditional-style reading and ask follow-ups', tint: color.secondary, tintMuted: color.secondaryMuted },
];

export function PalmIntroScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PalmIntro'>>();
  const allowRescan = route.params?.allowRescan;

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <FadeInUp>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCircle}>
            <Hand size={40} color={color.accent} strokeWidth={1.5} />
          </View>
        </View>

        <Text variant="display" weight="semibold" style={styles.title}>{t('ui.PalmIntroScreen.beforeYouBegin')}</Text>
        <Text variant="subtitle" tone="accent" weight="semibold" style={styles.tagline}>
          Everything is written in your palm.
        </Text>
      </FadeInUp>

      {steps.map((step, i) => (
        <FadeInUp key={step.title} delay={100 + i * 90}>
          <View style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View style={[styles.stepIcon, { backgroundColor: step.tintMuted, borderColor: step.tint }]}>
                <step.icon size={18} color={step.tint} strokeWidth={1.75} />
              </View>
              {i < steps.length - 1 && <View style={styles.stepConnector} />}
            </View>
            <Card elevated style={styles.stepCard}>
              <View style={styles.stepBadge}>
                <Text variant="caption" weight="semibold" style={{ color: step.tint }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{step.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{step.description}</Text>
              </View>
            </Card>
          </View>
        </FadeInUp>
      ))}

      <FadeInUp delay={400}>
        <Card style={styles.safetyCard}>
          <View style={styles.row}>
            <View style={styles.safetyIcon}>
              <ShieldCheck size={16} color={color.success} strokeWidth={1.75} />
            </View>
            <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1, lineHeight: 18 }}>
              {t('ui.PalmIntroScreen.weNeverUseYourPalm')}
            </Text>
          </View>
        </Card>
      </FadeInUp>

      <Button label={t('ui.OnboardingAstrologySystemScreen.continue')} fullWidth onPress={() => navigation.navigate('PalmCapture', { allowRescan })} />
      <Text variant="caption" tone="muted" style={styles.finePrint}>
        {t('ui.PalmIntroScreen.yourReadingIsGeneratedFrom')}
      </Text>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: color.accentMuted,
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tagline: {
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  finePrint: {
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stepRail: {
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: spacing.md,
    backgroundColor: color.border,
    marginVertical: 4,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginBottom: spacing.sm,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyCard: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: color.successMuted,
    borderColor: 'rgba(111, 190, 143, 0.35)',
  },
  safetyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
