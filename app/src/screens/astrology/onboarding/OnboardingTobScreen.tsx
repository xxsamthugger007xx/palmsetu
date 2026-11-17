import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Clock } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { Button, IconButton } from '../../../components/Button';
import { color, spacing } from '../../../theme/tokens';
import { AstrologyOnboardingStackParamList } from '../../../navigation/AstrologyOnboardingStack';
import { astrologyApi } from '../../../services/astrologyApi';

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function toTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

export function OnboardingTobScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AstrologyOnboardingStackParamList>>();
  const [time, setTime] = useState<Date | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    astrologyApi.getOnboardingDraft()
      .then((d) => {
        if (d.birthTime) {
          const [h, m] = d.birthTime.split(':').map(Number);
          const t = new Date();
          t.setHours(h, m, 0, 0);
          setTime(t);
        } else if (d.birthTimeSkipped) {
          setSkipped(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type !== 'dismissed' && selected) { setTime(selected); setSkipped(false); }
    if (Platform.OS === 'android') setShowPicker(false);
  };

  const canContinue = time !== null || skipped;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    setError(null);
    try {
      await astrologyApi.saveOnboardingDraft(
        skipped
          ? { birthTime: null, birthTimeSkipped: true }
          : { birthTime: toTimeString(time as Date), birthTimeSkipped: false },
      );
      navigation.navigate('OnboardingPlace');
    } catch (err: any) {
      console.warn('[onboarding] failed to save birth time:', err);
      setError(err?.isNetworkError ? 'Unable to connect. Check your connection and try again.' : (err?.message ?? 'Something went wrong. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>STEP 3 OF 5</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs }}>What time were you born?</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Check your birth certificate or ask a parent if unsure - even a 30-minute difference can shift your Moon
        sign near a sign boundary.
      </Text>

      <Card
        onPress={() => { setShowPicker(true); setSkipped(false); }}
        style={[styles.selectorCard, skipped && styles.selectorCardDisabled]}
      >
        <Clock size={16} color={color.accent} strokeWidth={1.75} />
        <Text variant="bodySm" tone={time && !skipped ? 'primary' : 'muted'} style={{ marginLeft: spacing.sm }}>
          {time && !skipped ? formatTime(time) : 'Select time of birth'}
        </Text>
      </Card>
      {showPicker && (
        <DateTimePicker
          value={time ?? new Date(2000, 0, 1, 12, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}

      <Card
        onPress={() => { setSkipped(true); setTime(null); }}
        style={[styles.skipCard, skipped && styles.skipCardActive]}
      >
        <Text variant="bodySm" weight="medium" tone={skipped ? 'accent' : 'primary'}>
          I don't know my exact birth time
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
          Some calculations (Moon sign, nakshatra, daily transits) may be less precise without an exact time.
        </Text>
      </Card>

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Button
        label="Continue"
        fullWidth
        disabled={!canContinue}
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
  selectorCardDisabled: { opacity: 0.5 },
  skipCard: { marginTop: spacing.md, borderWidth: 1, borderColor: color.border },
  skipCardActive: { borderColor: color.accent },
});
