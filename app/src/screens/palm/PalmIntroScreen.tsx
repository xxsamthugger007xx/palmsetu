import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanEye, Sparkles, MessageCircleQuestion, ShieldCheck, ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';

const steps = [
  { icon: ScanEye, title: 'Capture', description: 'Photograph your palm in good lighting' },
  { icon: Sparkles, title: 'Detect', description: 'We identify visible lines and regions' },
  { icon: MessageCircleQuestion, title: 'Reflect', description: 'Get a traditional-style reading and ask follow-ups' },
];

export function PalmIntroScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="display" weight="semibold" style={{ marginTop: spacing.md }}>Before you begin</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        Your reading is generated from traditional palmistry interpretations applied to the lines and
        regions visible in your photo. It's designed for entertainment and self-reflection - not as a
        scientific, medical, or predictive assessment.
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
            We never use your palm photo to diagnose a health condition, and never promise guaranteed
            outcomes about wealth, relationships, or lifespan. Your photo is processed securely and you
            can delete it at any time.
          </Text>
        </View>
      </Card>

      <Button label="Continue" fullWidth onPress={() => navigation.navigate('PalmCapture')} />
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
