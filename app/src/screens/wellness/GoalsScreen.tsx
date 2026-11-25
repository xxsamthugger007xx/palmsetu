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
import { useTranslation } from 'react-i18next';

import { asApiError, ApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
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
  const { t } = useTranslation();
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
      .catch((err: ApiError) => setError(err.message ?? t('ui.GoalsScreen.couldNotLoadGoalsPlease')))
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
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.GoalsScreen.couldNotCreateGoal'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.GoalsScreen.goals')}</Text>
        <ListSkeleton rows={3} />
      </PageContainer>
    );
  }

  if (error && goals.length === 0 && !showForm) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.GoalsScreen.goals')}</Text>
        <EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer onRefresh={load}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xs }}>
        <Text variant="display" weight="semibold">{t('ui.GoalsScreen.goals')}</Text>
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.lg }}>
        {t('ui.GoalsScreen.progressHereIsAlwaysWhat')}
      </Text>

      <SectionHeader
        title={t('ui.GoalsScreen.activeGoals')}
        action="Completed"
        onActionPress={() => navigation.navigate('GoalsCompleted')}
      />

      {goals.length === 0 ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" tone="secondary">{t('ui.GoalsScreen.noActiveGoalsYetAdd')}</Text>
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
        <Button label={t('ui.GoalsScreen.newGoal')} icon={Plus} variant="secondary" onPress={() => setShowForm(true)} style={{ marginTop: spacing.sm }} />
      ) : (
        <Card style={{ marginTop: spacing.sm }}>
          <Text variant="bodySm" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.GoalsScreen.newGoal')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('ui.GoalsScreen.goalTitle')} accessibilityLabel={t('ui.GoalsScreen.goalTitle')}
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <TextInput
            value={targetFrequency}
            onChangeText={setTargetFrequency}
            placeholder={t('ui.GoalsScreen.targetFrequencyOptionalEG')} accessibilityLabel={t('ui.GoalsScreen.targetFrequencyOptionalEG')}
            placeholderTextColor={color.textMuted}
            style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm }}
          />
          <Text variant="caption" tone="muted" style={{ marginBottom: spacing.xs }}>{t('ui.GoalsScreen.category')}</Text>
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
            <Button label={t('ui.GoalsScreen.create')} icon={CheckCircle2} onPress={createGoal} loading={creating} disabled={!title.trim()} />
            <Button label={t('ui.AssistantHistoryScreen.cancel')} variant="ghost" onPress={() => setShowForm(false)} style={{ marginLeft: spacing.sm }} />
          </View>
        </Card>
      )}
    </PageContainer>
  );
}
