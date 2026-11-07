import React from 'react';
import { Alert, TextInput, View } from 'react-native';
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

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GoalDetail'>;

export function GoalDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [goal, setGoal] = React.useState<WellnessGoal | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
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
      .catch((err: any) => setError(err.message ?? 'Could not load this goal.'))
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
    } catch (err: any) {
      setError(err?.message ?? 'Could not log progress.');
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
    } catch (err: any) {
      setError(err?.message ?? 'Could not mark goal complete.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!goal) return;
    Alert.alert('Delete this goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await wellnessApi.deleteGoal(goal.id);
            navigation.goBack();
          } catch (err: any) {
            setError(err?.message ?? 'Could not delete this goal.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>Loading...</Text></PageContainer>;
  }

  if (error && !goal) {
    return <PageContainer><EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  if (!goal) return null;

  const saveEdit = async () => {
    if (!goal || !editTitle.trim()) return;
    setBusy(true);
    try {
      const res = await wellnessApi.updateGoal(goal.id, { title: editTitle.trim(), targetFrequency: editFrequency.trim() || undefined });
      setGoal(res.goal);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Could not update this goal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
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
            onChangeText={setEditTitle}
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <TextInput
            value={editFrequency}
            onChangeText={setEditFrequency}
            placeholder="Target frequency"
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <View style={{ flexDirection: 'row' }}>
            <Button label="Save" onPress={saveEdit} loading={busy} disabled={!editTitle.trim()} />
            <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ marginLeft: spacing.sm }} />
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
          <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.xs }}>Completed</Text>
        </Card>
      ) : (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.xs }}>Log today's progress (user-reported)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional note about today"
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <View style={{ flexDirection: 'row' }}>
            <Button label="Log progress" icon={Target} onPress={addProgress} loading={busy} />
            <Button label="Mark complete" variant="secondary" onPress={complete} style={{ marginLeft: spacing.sm }} />
          </View>
        </Card>
      )}

      <SectionHeader title="User-reported history" />
      {goal.progress.length === 0 ? (
        <Text variant="bodySm" tone="muted" style={{ marginBottom: spacing.lg }}>No check-ins logged yet.</Text>
      ) : (
        [...goal.progress].reverse().map((p, i) => (
          <Card key={i} style={{ marginBottom: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">{p.localDate}</Text>
            {p.note && <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{p.note}</Text>}
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>User-reported</Text>
          </Card>
        ))
      )}

      {goal.status !== 'completed' && (
        <Button label="Delete goal" icon={Trash2} variant="danger" onPress={remove} style={{ marginTop: spacing.lg }} />
      )}
    </PageContainer>
  );
}

export function GoalsCompletedScreen() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [goals, setGoals] = React.useState<WellnessGoal[]>([]);
  const navigation = useNavigation<Nav>();

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getGoals('completed')
      .then((res) => setGoals(res.goals))
      .catch((err: any) => setError(err.message ?? 'Could not load completed goals.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  if (loading) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>Loading...</Text></PageContainer>;
  }

  if (error) {
    return <PageContainer><EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Completed Goals</Text>
      {goals.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No completed goals yet" description="Goals you complete will show up here." />
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
