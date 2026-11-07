import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Heart, ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { Button, IconButton } from '../../../components/Button';
import { color, radius, spacing } from '../../../theme/tokens';
import { RootStackParamList } from '../../../navigation/types';

type Answers = {
  yourGender: string | null;
  soulmateGender: string | null;
  ageRange: string | null;
  priority: string | null;
};

const STEP_COUNT = 4;

const genderOptions = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];
const ageOptions = ['20-29', '30-39', '40-49', '50+', 'No preference'];
const priorityOptions = ['Kindness', 'Ambition', 'Humor', 'Shared values', 'No preference'];

/**
 * A short preference quiz leading into the premium paywall - this does not
 * generate an AI portrait (no image-generation pipeline is wired into this
 * app yet). Reflective compatibility content only; never implies a guaranteed
 * match or scientific prediction.
 */
export function SoulmateQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    yourGender: null,
    soulmateGender: null,
    ageRange: null,
    priority: null,
  });

  const stepConfig = [
    { key: 'yourGender' as const, title: 'What is your gender?', options: genderOptions },
    { key: 'soulmateGender' as const, title: "Your soulmate's gender?", options: genderOptions },
    { key: 'ageRange' as const, title: 'Ideal soulmate age?', options: ageOptions },
    { key: 'priority' as const, title: 'What matters most to you in a soulmate?', options: priorityOptions },
  ];

  const current = stepConfig[step];
  const selected = answers[current.key];

  const handleSelect = (value: string) => {
    setAnswers((prev) => ({ ...prev, [current.key]: value }));
  };

  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleContinue = () => {
    if (!selected) return;
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
    } else {
      navigation.navigate('Paywall');
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={handleBack} />
        <View style={styles.progressRow}>
          {stepConfig.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.iconWrap}>
        <Heart size={22} color={color.accent} strokeWidth={1.75} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{current.title}</Text>
      <Text variant="caption" tone="muted" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        Step {step + 1} of {STEP_COUNT} - used only to personalize your compatibility reflection.
      </Text>

      {current.options.map((opt) => {
        const isSelected = selected === opt;
        return (
          <Card
            key={opt}
            elevated={isSelected}
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={() => handleSelect(opt)}
          >
            <Text variant="bodySm" weight={isSelected ? 'semibold' : 'regular'}>{opt}</Text>
          </Card>
        );
      })}

      <Button
        label={step === STEP_COUNT - 1 ? 'See my results' : 'Continue'}
        fullWidth
        disabled={!selected}
        style={{ marginTop: spacing.lg }}
        onPress={handleContinue}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressDot: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
  },
  progressDotActive: {
    backgroundColor: color.accent,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  option: {
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: color.accentBorder,
  },
});
