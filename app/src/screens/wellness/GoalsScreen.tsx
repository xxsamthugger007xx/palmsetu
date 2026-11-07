import React from 'react';
import { TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Target, Plus, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, WellnessGoal, WellnessGoalCategory, WELLNESS_GOAL_CATEGORIES } from '../../services/wellnessApi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_LABELS: Record<WellnessGoalCategory, string> = {
  sleep: 'Sleep',
  exercise: 'Exercise',
  nutrition: 'Nutrition',
  mindfulness: 'Mindfulness',
  'screen-time': 'Screen Time',
  'social-connection': 'Social Connection',
  'gratitude-practice': 'Gratitude Practice',
  'stress-management': 'Stress Management',
  'personal-growth': 'Personal Growth',
  'water-intake': 'Water Intake',
};

export function GoalsScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [goals, setGoals] = React.useState<WellnessGoal[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState<WellnessGoalCategory>('mindfulness');
  const [targetFrequency, setTargetFrequency] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getGoals('active')
      .then((res) => setGoals(res.goals))
      .catch((err: any) => setError(err.message ?? 'Could not load goals. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const createGoal = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await wellnessApi.createGoal({ category, title: title.trim(), targetFrequency: targetFrequency.trim() || undefined });
      setTitle('');
      setTargetFrequency('');
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Could not create goal.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Goals</Text>
        <Text variant="bodySm" tone="muted">Loading...</Text>
      </PageContainer>
    );
  }

  if (error && goals.length === 0 && !showForm) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Goals</Text>
        <EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs }}>
        <Text variant="display" weight="semibold">Goals</Text>
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.lg }}>
        Progress here is always what you report yourself - nothing is measured automatically.
      </Text>

      <SectionHeader
        title="Active goals"
        action="Completed"
        onActionPress={() => navigation.navigate('GoalsCompleted')}
      />

      {goals.length === 0 ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" tone="secondary">No active goals yet - add one below.</Text>
        </Card>
      ) : (
        goals.map((g) => (
          <Card key={g.id} onPress={() => navigation.navigate('GoalDetail', { id: g.id })} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Target size={16} color={color.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text variant="bodySm" weight="semibold">{g.title}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {CATEGORY_LABELS[g.category]}{g.targetFrequency ? ` - ${g.targetFrequency}` : ''}
                </Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {g.progress.length} user-reported check-in{g.progress.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}

      {!showForm ? (
        <Button label="New goal" icon={Plus} variant="secondary" onPress={() => setShowForm(true)} style={{ marginTop: spacing.sm }} />
      ) : (
        <Card style={{ marginTop: spacing.sm }}>
          <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.sm }}>New goal</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Goal title"
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <TextInput
            value={targetFrequency}
            onChangeText={setTargetFrequency}
            placeholder="Target frequency (optional), e.g. 4x per week"
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <Text variant="caption" tone="muted" style={{ marginBottom: spacing.xs }}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
            {WELLNESS_GOAL_CATEGORIES.map((c) => (
              <Button
                key={c}
                label={CATEGORY_LABELS[c]}
                size="sm"
                variant={category === c ? 'primary' : 'secondary'}
                onPress={() => setCategory(c)}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Button label="Create" icon={CheckCircle2} onPress={createGoal} loading={creating} disabled={!title.trim()} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ marginLeft: spacing.sm }} />
          </View>
        </Card>
      )}
    </PageContainer>
  );
}
