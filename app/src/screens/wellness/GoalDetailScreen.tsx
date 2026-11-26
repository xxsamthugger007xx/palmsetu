import { tr } from '../../utils/tr';
import React from 'react';
import { TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, Trash2, RefreshCw, Target, Pencil } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, WellnessGoal } from '../../services/wellnessApi';
import { tick, success } from '../../services/haptics';
import { useTranslation } from 'react-i18next';

import { asApiError, ApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
import { ConfirmationModal } from '../../components/ConfirmationModal';
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GoalDetail'>;

export function GoalDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [goal, setGoal] = React.useState<WellnessGoal | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editFrequency, setEditFrequency] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getGoals()
      .then((res) => {
        const found = res.goals.find((g) => g.id === params.id);
        if (!found) throw new Error('Goal not found.');
        setGoal(found);
        setEditTitle(found.title);
        setEditFrequency(found.targetFrequency ?? '');
      })
      .catch((err: ApiError) => setError(err.message ?? t('ui.GoalDetailScreen.couldNotLoadThisGoal')))
      .finally(() => setLoading(false));
  }, [params.id]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const addProgress = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      const res = await wellnessApi.addGoalProgress(goal.id, note.trim() || undefined);
      setGoal(res.goal);
      setNote('');
      tick();
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.GoalDetailScreen.couldNotLogProgress'));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      const res = await wellnessApi.completeGoal(goal.id);
      setGoal(res.goal);
      success();
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.GoalDetailScreen.couldNotMarkGoalComplete'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!goal) return;
    setConfirmDelete(true);
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    if (!goal) return;
    try {
      await wellnessApi.deleteGoal(goal.id);
      navigation.goBack();
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.GoalDetailScreen.couldNotDeleteThisGoal'));
    }
  };

  if (loading) {
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }

  if (error && !goal) {
    return <PageContainer><EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  if (!goal) return null;

  const saveEdit = async () => {
    if (!goal || !editTitle.trim()) return;
    setBusy(true);
    try {
      const res = await wellnessApi.updateGoal(goal.id, { title: editTitle.trim(), targetFrequency: editFrequency.trim() || undefined });
      setGoal(res.goal);
      setEditing(false);
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.GoalDetailScreen.couldNotUpdateThisGoal'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer onRefresh={load}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: spacing.sm }}>
        <Text variant="display" weight="semibold" style={{ flex: 1 }}>{goal.title}</Text>
        {goal.status !== 'completed' && !editing && (
          <IconButton icon={Pencil} tone={color.textMuted} onPress={() => setEditing(true)} />
        )}
      </View>

      {editing ? (
        <Card style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          <TextInput
            value={editTitle}
            accessibilityLabel={tr('a11y.goalTitle')}
            onChangeText={setEditTitle}
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <TextInput
            value={editFrequency}
            onChangeText={setEditFrequency}
            placeholder={t('ui.GoalDetailScreen.targetFrequency')} accessibilityLabel={t('ui.GoalDetailScreen.targetFrequency')}
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <View style={{ flexDirection: 'row' }}>
            <Button label={t('ui.GoalDetailScreen.save')} onPress={saveEdit} loading={busy} disabled={!editTitle.trim()} />
            <Button label={t('ui.AssistantHistoryScreen.cancel')} variant="ghost" onPress={() => setEditing(false)} style={{ marginLeft: spacing.sm }} />
          </View>
        </Card>
      ) : (
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
          {goal.category}{goal.targetFrequency ? ` - ${goal.targetFrequency}` : ''}{goal.targetDuration ? ` - ${goal.targetDuration}` : ''}
        </Text>
      )}
      {goal.description && <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.lg }}>{goal.description}</Text>}

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}

      {goal.status === 'completed' ? (
        <Card elevated style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <CheckCircle2 size={20} color={color.success} strokeWidth={2} />
          <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.xs }}>{t('ui.GoalDetailScreen.completed')}</Text>
        </Card>
      ) : (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.xs }}>{t('ui.GoalDetailScreen.logTodaySProgressUser')}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('ui.GoalDetailScreen.optionalNoteAboutToday')} accessibilityLabel={t('ui.GoalDetailScreen.optionalNoteAboutToday')}
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <View style={{ flexDirection: 'row' }}>
            <Button label={t('ui.GoalDetailScreen.logProgress')} icon={Target} onPress={addProgress} loading={busy} />
            <Button label={t('ui.GoalDetailScreen.markComplete')} variant="secondary" onPress={complete} style={{ marginLeft: spacing.sm }} />
          </View>
        </Card>
      )}

      <SectionHeader title={t('ui.GoalDetailScreen.userReportedHistory')} />
      {goal.progress.length === 0 ? (
        <Text variant="bodySm" tone="muted" style={{ marginBottom: spacing.lg }}>{t('ui.GoalDetailScreen.noCheckInsLoggedYet')}</Text>
      ) : (
        [...goal.progress].reverse().map((p, i) => (
          <Card key={i} style={{ marginBottom: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">{p.localDate}</Text>
            {p.note && <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{p.note}</Text>}
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('ui.GoalDetailScreen.userReported')}</Text>
          </Card>
        ))
      )}

      {goal.status !== 'completed' && (
        <Button label={t('ui.GoalDetailScreen.deleteGoal')} icon={Trash2} variant="danger" onPress={remove} style={{ marginTop: spacing.lg }} />
      )}

      <ConfirmationModal
        visible={confirmDelete}
        title={t('ui.GoalDetailScreen.deleteThisGoal')}
        description={t('ui.AssistantHistoryScreen.thisCannotBeUndone')}
        confirmLabel={t('ui.AssistantHistoryScreen.delete')}
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}

export function GoalsCompletedScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [goals, setGoals] = React.useState<WellnessGoal[]>([]);
  const navigation = useNavigation<Nav>();

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getGoals('completed')
      .then((res) => setGoals(res.goals))
      .catch((err: ApiError) => setError(err.message ?? t('ui.GoalsCompletedScreen.couldNotLoadCompletedGoals')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  if (loading) {
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }

  if (error) {
    return <PageContainer><EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.GoalsCompletedScreen.completedGoals')}</Text>
      {goals.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('ui.GoalsCompletedScreen.noCompletedGoalsYet')} description={t('ui.GoalsCompletedScreen.goalsYouCompleteWillShow')} />
      ) : (
        goals.map((g) => (
          <Card key={g.id} onPress={() => navigation.navigate('GoalDetail', { id: g.id })} style={{ marginBottom: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">{g.title}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>Completed {g.completedAt ? new Date(g.completedAt).toLocaleDateString() : ''}</Text>
          </Card>
        ))
      )}
    </PageContainer>
  );
}
