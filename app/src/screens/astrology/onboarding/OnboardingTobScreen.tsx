import { devWarn } from '../../../utils/log';
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
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../../services/apiRequest';
import { appLocale } from '../../../utils/locale';
function formatTime(d: Date): string {
  return d.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
}
function toTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

export function OnboardingTobScreen() {
  const { t } = useTranslation();
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
    } catch (__err) {
      const err = asApiError(__err);
      devWarn('[onboarding] failed to save birth time:', err);
      setError(err?.isNetworkError ? t('ui.OnboardingAstrologySystemScreen.unableToConnectCheckYour') : (err?.message ?? t('ui.OnboardingAstrologySystemScreen.somethingWentWrongPleaseTry')));
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
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>{t('ui.OnboardingTobScreen.step3Of5')}</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs }}>{t('ui.OnboardingTobScreen.whatTimeWereYouBorn')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.AstrologyProfileSetupScreen.checkYourBirthCertificateOr')}
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
          themeVariant="dark"
          onChange={handleChange}
        />
      )}

      <Card
        onPress={() => { setSkipped(true); setTime(null); }}
        style={[styles.skipCard, skipped && styles.skipCardActive]}
      >
        <Text variant="bodySm" weight="medium" tone={skipped ? 'accent' : 'primary'}>
          {t('ui.OnboardingTobScreen.iDonTKnowMy')}
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {t('ui.OnboardingTobScreen.someCalculationsMoonSignNakshatra')}
        </Text>
      </Card>

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Button
        label={t('ui.OnboardingAstrologySystemScreen.continue')}
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
