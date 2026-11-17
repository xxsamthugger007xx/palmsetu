import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Globe2, Pencil, Brush, Feather } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import {
  SoulmateAgeRange, SoulmateGender, SoulmateStyle,
} from '../../types/soulmate';

const SHORTLIST_COUNTRIES = [
  { id: 'india', label: 'India' },
  { id: 'united-states', label: 'United States' },
  { id: 'united-kingdom', label: 'United Kingdom' },
  { id: 'canada', label: 'Canada' },
  { id: 'australia', label: 'Australia' },
  { id: 'no-preference', label: 'No preference' },
];

const MORE_COUNTRIES = [
  { id: 'germany', label: 'Germany' },
  { id: 'france', label: 'France' },
  { id: 'italy', label: 'Italy' },
  { id: 'spain', label: 'Spain' },
  { id: 'japan', label: 'Japan' },
  { id: 'south-korea', label: 'South Korea' },
  { id: 'brazil', label: 'Brazil' },
  { id: 'mexico', label: 'Mexico' },
  { id: 'united-arab-emirates', label: 'United Arab Emirates' },
  { id: 'south-africa', label: 'South Africa' },
  { id: 'indonesia', label: 'Indonesia' },
  { id: 'china', label: 'China' },
];

const GENDER_OPTIONS: { id: SoulmateGender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'no-preference', label: 'No preference' },
];

const AGE_OPTIONS: { id: SoulmateAgeRange; label: string }[] = [
  { id: '18-24', label: '18-24' },
  { id: '25-30', label: '25-30' },
  { id: '31-35', label: '31-35' },
  { id: '36-40', label: '36-40' },
  { id: '40+', label: '40+' },
];

const STYLE_OPTIONS: { id: SoulmateStyle; label: string; description: string; icon: typeof Pencil }[] = [
  { id: 'pencil', label: 'Realistic pencil sketch', description: 'Fine graphite linework, naturalistic shading', icon: Pencil },
  { id: 'charcoal', label: 'Charcoal portrait', description: 'Soft smudged shading, rich dark contrast', icon: Brush },
  { id: 'soft-portrait', label: 'Soft artistic portrait', description: 'Gentle pastel-like shading, delicate linework', icon: Feather },
];

const STEP_COUNT = 4;

export function SoulmateQuestionnaireScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SoulmateQuestionnaire'>>();
  const isFreeTrial = route.params.intent === 'free';
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<SoulmateGender | null>(null);
  const [ageRange, setAgeRange] = useState<SoulmateAgeRange | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [showMoreCountries, setShowMoreCountries] = useState(false);
  const [style, setStyle] = useState<SoulmateStyle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    soulmateApi.recordQuestionnaireStarted();
  }, []);

  const selected = [gender, ageRange, country, style][step];

  const handleBack = () => {
    if (step === 0) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const handleContinue = async () => {
    if (!selected) return;
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
      return;
    }
    if (!gender || !ageRange || !country || !style) return;
    const answers = { preferredGender: gender, preferredAgeRange: ageRange, preferredCountry: country, style };

    if (!isFreeTrial) {
      navigation.navigate('SoulmatePayment', answers);
      return;
    }

    // Free-trial path: no payment screen at all. Create the free sketch
    // directly (server independently re-verifies real eligibility - see
    // routes/soulmate.ts) and go straight into selection.
    setError(null);
    setSubmitting(true);
    try {
      const res = await soulmateApi.createSketch(answers, true);
      navigation.replace('SoulmateGenerating', { sketchId: res.sketch.id });
    } catch (err: any) {
      if (err.code === 'TRIAL_ALREADY_USED' && err.sketch) {
        navigation.replace('SoulmateGenerating', { sketchId: err.sketch.id });
      } else {
        setError(err.message ?? 'Could not start your free sketch. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={handleBack} />
        <View style={styles.progressRow}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <Text variant="label" tone="muted" style={{ marginTop: spacing.lg }}>STEP {step + 1} OF {STEP_COUNT}</Text>

      {step === 0 && (
        <>
          <Text variant="title" weight="semibold" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            Preferred soulmate gender
          </Text>
          {GENDER_OPTIONS.map((opt) => (
            <OptionCard key={opt.id} label={opt.label} selected={gender === opt.id} onPress={() => setGender(opt.id)} />
          ))}
        </>
      )}

      {step === 1 && (
        <>
          <Text variant="title" weight="semibold" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            Preferred age range
          </Text>
          {AGE_OPTIONS.map((opt) => (
            <OptionCard key={opt.id} label={opt.label} selected={ageRange === opt.id} onPress={() => setAgeRange(opt.id)} />
          ))}
        </>
      )}

      {step === 2 && (
        <>
          <Text variant="title" weight="semibold" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            Preferred country or cultural background
          </Text>
          {SHORTLIST_COUNTRIES.map((opt) => (
            <OptionCard key={opt.id} label={opt.label} selected={country === opt.id} onPress={() => setCountry(opt.id)} />
          ))}
          {showMoreCountries ? (
            MORE_COUNTRIES.map((opt) => (
              <OptionCard key={opt.id} label={opt.label} selected={country === opt.id} onPress={() => setCountry(opt.id)} />
            ))
          ) : (
            <Card onPress={() => setShowMoreCountries(true)} style={styles.moreCountriesCard}>
              <Globe2 size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" tone="accent" weight="semibold" style={{ marginLeft: spacing.sm }}>
                More countries
              </Text>
            </Card>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <Text variant="title" weight="semibold" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
            Preferred portrait style
          </Text>
          {STYLE_OPTIONS.map((opt) => {
            const isSelected = style === opt.id;
            return (
              <Card key={opt.id} elevated={isSelected} style={[styles.styleOption, isSelected && styles.optionSelected]} onPress={() => setStyle(opt.id)}>
                <View style={styles.styleIcon}>
                  <opt.icon size={18} color={color.accent} strokeWidth={1.75} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="bodySm" weight={isSelected ? 'semibold' : 'regular'}>{opt.label}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{opt.description}</Text>
                </View>
              </Card>
            );
          })}
        </>
      )}

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.md }}>{error}</Text>
      )}

      <Button
        label={step === STEP_COUNT - 1 ? (isFreeTrial ? 'Create my free sketch' : 'Continue to payment') : 'Continue'}
        fullWidth
        disabled={!selected || submitting}
        loading={submitting}
        style={{ marginTop: spacing.lg }}
        onPress={handleContinue}
      />
    </PageContainer>
  );
}

function OptionCard({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Card elevated={selected} style={[styles.option, selected && styles.optionSelected]} onPress={onPress}>
      <Text variant="bodySm" weight={selected ? 'semibold' : 'regular'}>{label}</Text>
    </Card>
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
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
  },
  progressDotActive: {
    backgroundColor: color.accent,
  },
  option: {
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: color.accentBorder,
  },
  moreCountriesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  styleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
