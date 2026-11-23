import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanEye, Sparkles, MessageCircleQuestion, ShieldCheck, ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const steps = [
  { icon: ScanEye, title: 'Capture', description: 'Photograph your palm in good lighting' },
  { icon: Sparkles, title: 'Detect', description: 'We identify visible lines and regions' },
  { icon: MessageCircleQuestion, title: 'Reflect', description: 'Get a traditional-style reading and ask follow-ups' },
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

      <Text variant="display" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.PalmIntroScreen.beforeYouBegin')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        {t('ui.PalmIntroScreen.yourReadingIsGeneratedFrom')}
      </Text>

      {steps.map((step, i) => (
        <Card key={step.title} style={styles.stepCard}>
          <View style={styles.stepIcon}>
            <step.icon size={18} color={color.accent} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="bodySm" weight="semibold">{i + 1}. {step.title}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{step.description}</Text>
          </View>
        </Card>
      ))}

      <Card style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        <View style={styles.row}>
          <ShieldCheck size={16} color={color.secondary} strokeWidth={1.75} />
          <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
            {t('ui.PalmIntroScreen.weNeverUseYourPalm')}
          </Text>
        </View>
      </Card>

      <Button label={t('ui.OnboardingAstrologySystemScreen.continue')} fullWidth onPress={() => navigation.navigate('PalmCapture', { allowRescan })} />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
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
});
