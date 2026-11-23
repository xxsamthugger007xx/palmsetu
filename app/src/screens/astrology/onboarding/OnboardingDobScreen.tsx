import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Calendar } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { Button, IconButton } from '../../../components/Button';
import { color, spacing } from '../../../theme/tokens';
import { AstrologyOnboardingStackParamList } from '../../../navigation/AstrologyOnboardingStack';
import { astrologyApi } from '../../../services/astrologyApi';

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function OnboardingDobScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AstrologyOnboardingStackParamList>>();
  const [date, setDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    astrologyApi.getOnboardingDraft()
      .then((d) => { if (d.birthDate) setDate(new Date(`${d.birthDate}T00:00:00`)); })
      .catch(() => {});
  }, []);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) setDate(selected);
    if (Platform.OS === 'android') setShowPicker(false);
  };

  const handleContinue = async () => {
    if (!date) return;
    setSaving(true);
    setError(null);
    try {
      await astrologyApi.saveOnboardingDraft({ birthDate: toDateString(date) });
      navigation.navigate('OnboardingTob');
    } catch (err: any) {
      console.warn('[onboarding] failed to save birth date:', err);
      setError(err?.isNetworkError ? 'Unable to connect. Check your connection and try again.' : (err?.message ?? 'Something went wrong. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        )}
      </View>
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>STEP 2 OF 5</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs }}>When were you born?</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Used only for traditional astrology calculations - reflective interpretation, not scientific prediction.
      </Text>

      <Card onPress={() => setShowPicker(true)} style={styles.selectorCard}>
        <Calendar size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={date ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {date ? formatDate(date) : 'Select date of birth'}
        </Text>
      </Card>
      {showPicker && (
        <DateTimePicker
          value={date ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant="dark"
          maximumDate={new Date()}
          onChange={handleChange}
        />
      )}

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Button
        label="Continue"
        fullWidth
        disabled={!date}
        loading={saving}
        style={{ marginTop: spacing.xl }}
        onPress={handleContinue}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  selectorCard: { flexDirection: 'row', alignItems: 'center' },
});
