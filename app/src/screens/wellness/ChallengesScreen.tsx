import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trophy, Lock, RefreshCw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, ChallengeSummary, ChallengeProgress } from '../../services/wellnessApi';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ChallengesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [challenges, setChallenges] = React.useState<ChallengeSummary[]>([]);
  const [progress, setProgress] = React.useState<ChallengeProgress[]>([]);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([wellnessApi.getChallenges(), wellnessApi.getMyChallengeProgress()])
      .then(([c, p]) => { setChallenges(c.challenges); setProgress(p.progress); })
      .catch((err: ApiError) => setError(err.message ?? t('ui.ChallengesScreen.couldNotLoadChallengesPlease')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const progressFor = (id: string) => progress.find((p) => p.challengeId === id && p.status === 'active');

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.ChallengesScreen.challenges')}</Text>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.ChallengesScreen.challenges')}</Text>
        <EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('ui.ChallengesScreen.challenges')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.ChallengesScreen.multiDayGuidedProgramsJoin')}
      </Text>

      {challenges.length === 0 ? (
        <EmptyState icon={Trophy} title={t('ui.ChallengesScreen.noChallengesAvailable')} description={t('ui.BreathingTechniquesScreen.pleaseTryAgainLater')} />
      ) : (
        challenges.map((c) => {
          const active = progressFor(c.id);
          return (
            <Card
              key={c.id}
              onPress={() => navigation.navigate('ChallengeDetail', { id: c.id })}
              style={{ marginBottom: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Trophy size={18} color={c.allowed ? color.accent : color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text variant="bodySm" weight="semibold">{c.title}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{c.description}</Text>
                  <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                    {c.durationDays} days
                    {active ? ` - day ${active.currentDay} in progress` : ''}
                  </Text>
                </View>
                {!c.allowed && <Lock size={14} color={color.textMuted} strokeWidth={1.75} />}
              </View>
            </Card>
          );
        })
      )}
    </PageContainer>
  );
}
