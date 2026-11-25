import { devWarn } from '../../../utils/log';
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
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../../services/apiRequest';
import { appLocale } from '../../../utils/locale';
function formatDate(d: Date): string {
  return d.toLocaleDateString(appLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
}
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function OnboardingDobScreen() {
  const { t } = useTranslation();
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
    } catch (__err) {
      const err = asApiError(__err);
      devWarn('[onboarding] failed to save birth date:', err);
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
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>{t('ui.OnboardingDobScreen.step2Of5')}</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs }}>{t('ui.OnboardingDobScreen.whenWereYouBorn')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.OnboardingDobScreen.usedOnlyForTraditionalAstrology')}
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
        label={t('ui.OnboardingAstrologySystemScreen.continue')}
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
