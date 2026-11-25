import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Wind, Lock, RefreshCw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, BreathingTechniqueCatalogueEntry } from '../../services/wellnessApi';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function BreathingTechniquesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [techniques, setTechniques] = React.useState<BreathingTechniqueCatalogueEntry[]>([]);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getBreathingTechniques()
      .then((res) => setTechniques(res.techniques))
      .catch((err: ApiError) => setError(err.message ?? t('ui.BreathingTechniquesScreen.couldNotLoadBreathingTechniques')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const handleSelect = (technique: BreathingTechniqueCatalogueEntry) => {
    if (!technique.allowed) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('BreathingSession', { technique });
  };

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.BreathingTechniquesScreen.breathing')}</Text>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.BreathingTechniquesScreen.breathing')}</Text>
        <EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.BreathingTechniquesScreen.breathing')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.BreathingTechniquesScreen.chooseAGuidedBreathingTechnique')}
      </Text>

      {techniques.length === 0 ? (
        <EmptyState icon={Wind} title={t('ui.BreathingTechniquesScreen.noTechniquesAvailable')} description={t('ui.BreathingTechniquesScreen.pleaseTryAgainLater')} />
      ) : (
        techniques.map((t) => (
          <Card key={t.id} onPress={() => handleSelect(t)} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Wind size={18} color={t.allowed ? color.accent : color.textMuted} strokeWidth={1.75} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text variant="bodySm" weight="semibold">{t.name}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t.description}</Text>
              </View>
              {!t.allowed && <Lock size={14} color={color.textMuted} strokeWidth={1.75} />}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
              {t.phases.map((p) => `${p.label} ${p.seconds}s`).join(' - ')} - {t.defaultCycles} cycles
            </Text>
          </Card>
        ))
      )}
    </PageContainer>
  );
}
