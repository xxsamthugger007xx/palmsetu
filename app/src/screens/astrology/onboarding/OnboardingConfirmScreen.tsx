import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Pencil } from 'lucide-react-native';
import { PageContainer } from '../../../components/PageContainer';
import { Card } from '../../../components/Card';
import { Text } from '../../../components/Text';
import { Button, IconButton } from '../../../components/Button';
import { color, spacing } from '../../../theme/tokens';
import { AstrologyOnboardingStackParamList } from '../../../navigation/AstrologyOnboardingStack';
import { astrologyApi } from '../../../services/astrologyApi';
import { OnboardingDraft } from '../../../types/astrology';
import { useLanguage } from '../../../context/LanguageContext';
import { LANGUAGES } from '../../../data/languages';
import { useAstrologyOnboardingStatus } from '../../../context/AstrologyOnboardingStatus';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../../services/apiRequest';
import { appLocale } from '../../../utils/locale';
function formatDateLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(appLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <Card padded={false} style={styles.row}>
      <View style={styles.rowInner}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="muted">{label}</Text>
          <Text variant="bodySm" weight="medium" style={{ marginTop: 2 }}>{value}</Text>
        </View>
        <IconButton icon={Pencil} onPress={onEdit} size={16} />
      </View>
    </Card>
  );
}

export function OnboardingConfirmScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AstrologyOnboardingStackParamList>>();
  const { languageCode } = useLanguage();
  const { refresh } = useAstrologyOnboardingStatus();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    astrologyApi.getOnboardingDraft().then(setDraft).catch(() => {});
  }, []);

  const languageName = LANGUAGES.find((l) => l.code === languageCode)?.name ?? 'English';

  const handleConfirm = async () => {
    if (!draft || !draft.preferredSystem || !draft.birthDate || !draft.birthPlace || draft.birthLatitude == null || draft.birthLongitude == null || !draft.timezone) return;
    setConfirming(true);
    setError(null);
    try {
      // The real engine call (computeNatalSummary, see server/src/astrology/engine.ts)
      // is synchronous and fast - there is no genuine multi-second "chart
      // generation" to wait on here, so this loading state reflects the
      // actual network round trip only, not a fabricated delay.
      await astrologyApi.saveProfile({
        birthDate: draft.birthDate,
        birthTime: draft.birthTime,
        birthPlace: draft.birthPlace,
        latitude: draft.birthLatitude,
        longitude: draft.birthLongitude,
        preferredSystem: draft.preferredSystem,
        timezone: draft.timezone,
      });
      // RootNavigator's gating is driven by this shared status context -
      // refreshing it here (now that the real BirthProfile exists) is what
      // actually flips the app from the onboarding stack to MainTabs, no
      // separate "mark complete" flag involved.
      refresh();
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.AstrologyProfileSetupScreen.somethingWentWrongSavingYour'));
    } finally {
      setConfirming(false);
    }
  };

  if (!draft) return <PageContainer><View /></PageContainer>;

  return (
    <PageContainer>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        )}
      </View>
      <Text variant="label" tone="muted" style={{ marginTop: spacing.md }}>{t('ui.OnboardingConfirmScreen.step5Of5')}</Text>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>{t('ui.OnboardingConfirmScreen.confirmYourDetails')}</Text>

      {/* Language is shown for a complete summary but is not editable from
          here - it was already confirmed before this flow started and its
          own settings screen lives outside this onboarding stack. */}
      <Card padded={false} style={styles.row}>
        <View style={styles.rowInner}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">{t('ui.OnboardingConfirmScreen.language')}</Text>
            <Text variant="bodySm" weight="medium" style={{ marginTop: 2 }}>{languageName}</Text>
          </View>
        </View>
      </Card>
      <Row
        label={t('ui.AstrologyProfileSetupScreen.astrologySystem')}
        value={draft.preferredSystem === 'vedic' ? 'Vedic' : 'Western'}
        onEdit={() => navigation.navigate('OnboardingAstrologySystem')}
      />
      <Row
        label={t('ui.AstrologyProfileSetupScreen.dateOfBirth')}
        value={draft.birthDate ? formatDateLabel(draft.birthDate) : 'Not set'}
        onEdit={() => navigation.navigate('OnboardingDob')}
      />
      <Row
        label={t('ui.OnboardingConfirmScreen.timeOfBirth')}
        value={draft.birthTime ? formatTimeLabel(draft.birthTime) : 'Not known (some calculations will be less precise)'}
        onEdit={() => navigation.navigate('OnboardingTob')}
      />
      <Row
        label={t('ui.AstrologyProfileSetupScreen.birthplace')}
        value={draft.birthPlace ?? 'Not set'}
        onEdit={() => navigation.navigate('OnboardingPlace')}
      />

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}

      <Button
        label={t('ui.OnboardingConfirmScreen.confirmAndContinue')}
        fullWidth
        loading={confirming}
        style={{ marginTop: spacing.xl }}
        onPress={handleConfirm}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { marginBottom: spacing.sm, borderWidth: 1, borderColor: color.border },
  rowInner: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
});
