import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Trophy, RefreshCw, RotateCcw, LogOut } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, ChallengeDefinition, ChallengeProgress } from '../../services/wellnessApi';
import { useTranslation } from 'react-i18next';

import { asApiError, ApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
import { ConfirmationModal } from '../../components/ConfirmationModal';
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ChallengeDetail'>;

export function ChallengeDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [challenge, setChallenge] = React.useState<ChallengeDefinition | null>(null);
  const [allowed, setAllowed] = React.useState(true);
  const [progress, setProgress] = React.useState<ChallengeProgress | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'restart' | 'leave' | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([wellnessApi.getChallenge(params.id), wellnessApi.getMyChallengeProgress()])
      .then(([c, p]) => {
        setChallenge(c.challenge);
        setAllowed(c.allowed);
        setProgress(p.progress.find((pr) => pr.challengeId === params.id) ?? null);
      })
      .catch((err: ApiError) => setError(err.message ?? t('ui.ChallengeDetailScreen.couldNotLoadThisChallenge')))
      .finally(() => setLoading(false));
  }, [params.id]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const join = async () => {
    if (!allowed) { navigation.navigate('Paywall'); return; }
    setBusy(true);
    try {
      const res = await wellnessApi.joinChallenge(params.id);
      setProgress(res.progress);
    } catch (__err) {
      const err = asApiError(__err);
      if (err?.status === 403) navigation.navigate('Paywall');
      else setError(err?.message ?? t('ui.ChallengeDetailScreen.couldNotJoinThisChallenge'));
    } finally {
      setBusy(false);
    }
  };

  const completeDay = async (day: number) => {
    setBusy(true);
    try {
      const res = await wellnessApi.completeChallengeDay(params.id, day);
      setProgress(res.progress);
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.ChallengeDetailScreen.couldNotMarkThisDay'));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => setConfirmAction('restart');
  const leave = () => setConfirmAction('leave');

  const doRestart = async () => {
    setConfirmAction(null);
    setBusy(true);
    try {
      const res = await wellnessApi.restartChallenge(params.id);
      setProgress(res.progress);
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.ChallengeDetailScreen.couldNotRestartThisChallenge'));
    } finally {
      setBusy(false);
    }
  };

  const doLeave = async () => {
    setConfirmAction(null);
    setBusy(true);
    try {
      const res = await wellnessApi.leaveChallenge(params.id);
      setProgress(res.progress);
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.ChallengeDetailScreen.couldNotLeaveThisChallenge'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (error && !challenge) {
    return (
      <PageContainer>
        <EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  if (!challenge) return null;

  const isActive = progress?.status === 'active';
  const isCompleted = progress?.status === 'completed';

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{challenge.title}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
        {challenge.description}
      </Text>
      <Text variant="caption" tone="muted" style={{ marginBottom: spacing.lg }}>
        {challenge.durationDays}-day program - complete one task per day, at your own pace, for as many days as you like.
      </Text>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}

      {!progress && (
        <Button
          label={allowed ? 'Join this challenge' : 'Unlock with Premium'}
          icon={Trophy}
          onPress={join}
          loading={busy}
          fullWidth
          style={{ marginBottom: spacing.lg }}
        />
      )}

      {isCompleted && (
        <Card elevated style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
          <Check size={20} color={color.success} strokeWidth={2} />
          <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.xs }}>{t('ui.ChallengeDetailScreen.challengeCompleted')}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2, textAlign: 'center' }}>
            You completed all {challenge.durationDays} days. You can restart it any time.
          </Text>
          <Button label={t('ui.ChallengeDetailScreen.restart')} icon={RotateCcw} variant="secondary" size="sm" onPress={restart} style={{ marginTop: spacing.sm }} />
        </Card>
      )}

      {isActive && progress && (
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodySm" weight="semibold">
              Day {progress.currentDay} of {challenge.durationDays}
            </Text>
            <Text variant="caption" tone="muted">{progress.completedDays.length}/{challenge.durationDays} done</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: color.surfaceElevated, marginTop: spacing.sm, overflow: 'hidden' }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: color.accent, width: `${Math.round((progress.completedDays.length / challenge.durationDays) * 100)}%` }} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            <Button label={t('ui.ChallengeDetailScreen.restart')} icon={RotateCcw} variant="ghost" size="sm" onPress={restart} />
            <Button label={t('ui.ChallengeDetailScreen.leave')} icon={LogOut} variant="ghost" size="sm" onPress={leave} style={{ marginLeft: spacing.sm }} />
          </View>
        </Card>
      )}

      <SectionHeader title={t('ui.ChallengeDetailScreen.dayByDayTasks')} />
      {challenge.tasks.map((t) => {
        const done = progress?.completedDays.includes(t.day) ?? false;
        const unlockedForTap = isActive && !done;
        return (
          <Card
            key={t.day}
            onPress={unlockedForTap ? () => completeDay(t.day) : undefined}
            style={{ marginBottom: spacing.sm, opacity: progress && !isActive ? 0.7 : 1 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 1, marginTop: 1,
                borderColor: done ? color.success : color.border,
                backgroundColor: done ? color.successMuted : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {done ? <Check size={14} color={color.success} strokeWidth={2.5} /> : (
                  <Text variant="caption" tone="muted">{t.day}</Text>
                )}
              </View>
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text variant="bodySm" weight="semibold">Day {t.day}: {t.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t.description}</Text>
              </View>
            </View>
          </Card>
        );
      })}

      <ConfirmationModal
        visible={confirmAction === 'restart'}
        title={t('ui.ChallengeDetailScreen.restartThisChallenge')}
        description={t('ui.ChallengeDetailScreen.thisWipesAllYourProgress')}
        confirmLabel={t('ui.ChallengeDetailScreen.restart')}
        destructive
        onConfirm={doRestart}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmationModal
        visible={confirmAction === 'leave'}
        title={t('ui.ChallengeDetailScreen.leaveThisChallenge')}
        description={t('ui.ChallengeDetailScreen.yourProgressIsKeptBut')}
        confirmLabel={t('ui.ChallengeDetailScreen.leave')}
        destructive
        onConfirm={doLeave}
        onCancel={() => setConfirmAction(null)}
      />
    </PageContainer>
  );
}
