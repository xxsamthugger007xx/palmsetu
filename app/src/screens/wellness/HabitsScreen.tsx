import React from 'react';
import { TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Plus } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, Habit, PredefinedHabit } from '../../services/wellnessApi';

export function HabitsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [maxFree, setMaxFree] = React.useState(3);
  const [tier, setTier] = React.useState<'free' | 'premium'>('free');
  const [completedToday, setCompletedToday] = React.useState<Set<string>>(new Set());
  const [predefined, setPredefined] = React.useState<PredefinedHabit[]>([]);
  const [customName, setCustomName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    wellnessApi.getHabits().then((res) => { setHabits(res.habits); setMaxFree(res.maxFreeHabits); setTier(res.tier); }).catch(() => {});
  }, []);

  useFocusEffect(React.useCallback(() => {
    load();
    wellnessApi.getPredefinedHabits().then((res) => setPredefined(res.habits)).catch(() => setPredefined([]));
  }, [load]));

  const toggle = async (habit: Habit) => {
    const today = wellnessApi.todayLocalDate();
    const already = completedToday.has(habit.id);
    try {
      if (already) {
        await wellnessApi.uncompleteHabit(habit.id, today);
        setCompletedToday((p) => { const n = new Set(p); n.delete(habit.id); return n; });
      } else {
        await wellnessApi.completeHabit(habit.id, today);
        setCompletedToday((p) => new Set(p).add(habit.id));
      }
    } catch {}
  };

  const addHabit = async (name: string, description?: string) => {
    setError(null);
    try {
      await wellnessApi.createHabit({ name, description, frequency: 'daily' });
      setCustomName('');
      load();
    } catch (err: any) {
      if (err?.status === 403) {
        navigation.navigate('Paywall');
      } else {
        setError(err?.message ?? 'Could not add habit.');
      }
    }
  };

  const atLimit = tier === 'free' && habits.length >= maxFree;

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>Habits</Text>
      <Text variant="body" tone="secondary" style={{ marginBottom: spacing.lg }}>
        {tier === 'free' ? `Free plan: up to ${maxFree} active habits.` : 'Unlimited active habits.'}
      </Text>

      {habits.length === 0 && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" tone="secondary">No habits yet - add one below to get started.</Text>
        </Card>
      )}

      {habits.map((habit) => {
        const done = completedToday.has(habit.id);
        return (
          <Card key={habit.id} onPress={() => toggle(habit)} style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: done ? color.success : color.border, backgroundColor: done ? color.successMuted : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {done && <Check size={14} color={color.success} strokeWidth={2.5} />}
            </View>
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text variant="bodySm" weight="semibold">{habit.name}</Text>
              {habit.description && <Text variant="caption" tone="muted">{habit.description}</Text>}
            </View>
          </Card>
        );
      })}

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <SectionHeader title="Add a habit" />
        <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Custom habit name"
            placeholderTextColor={color.textMuted}
            style={{ flex: 1, color: color.textPrimary }}
          />
          <Button label="Add" size="sm" icon={Plus} disabled={!customName.trim() || atLimit} onPress={() => addHabit(customName.trim())} />
        </Card>
        {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}
        {atLimit && (
          <Card onPress={() => navigation.navigate('Paywall')}>
            <Text variant="bodySm" tone="accent">You've reached the free habit limit. Upgrade for unlimited habits.</Text>
          </Card>
        )}
        {!atLimit && predefined.length > 0 && (
          <Text variant="caption" tone="muted" style={{ marginBottom: spacing.xs }}>Suggestions</Text>
        )}
        {!atLimit && predefined.slice(0, 6).map((p) => (
          <Card key={p.id} onPress={() => addHabit(p.name, p.description)} style={{ marginBottom: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">{p.name}</Text>
            <Text variant="caption" tone="muted">{p.description}</Text>
          </Card>
        ))}
      </View>
    </PageContainer>
  );
}
