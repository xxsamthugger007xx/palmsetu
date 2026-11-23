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
import { ErrorBanner, ErrorState } from '../../components/ErrorState';
import { ListSkeleton } from '../../components/ListSkeleton';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, Habit, PredefinedHabit } from '../../services/wellnessApi';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
export function HabitsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [maxFree, setMaxFree] = React.useState(3);
  const [tier, setTier] = React.useState<'free' | 'premium'>('free');
  const [completedToday, setCompletedToday] = React.useState<Set<string>>(new Set());
  const [predefined, setPredefined] = React.useState<PredefinedHabit[]>([]);
  const [customName, setCustomName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [toggleError, setToggleError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadError(false);
    await wellnessApi.getHabits(wellnessApi.todayLocalDate())
      .then((res) => {
        setHabits(res.habits); setMaxFree(res.maxFreeHabits); setTier(res.tier);
        // Real "done today" state from the server (previously every habit looked unchecked after reopening).
        setCompletedToday(new Set(res.completedHabitIds ?? []));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const loadHabitsData = React.useCallback(async () => {
    await load();
    await wellnessApi.getPredefinedHabits().then((res) => setPredefined(res.habits)).catch(() => setPredefined([]));
  }, [load]);

  useFocusEffect(React.useCallback(() => {
    loadHabitsData();
  }, [loadHabitsData]));

  const toggle = async (habit: Habit) => {
    const today = wellnessApi.todayLocalDate();
    const already = completedToday.has(habit.id);
    setToggleError(null);
    try {
      if (already) {
        await wellnessApi.uncompleteHabit(habit.id, today);
        setCompletedToday((p) => { const n = new Set(p); n.delete(habit.id); return n; });
      } else {
        await wellnessApi.completeHabit(habit.id, today);
        setCompletedToday((p) => new Set(p).add(habit.id));
      }
    } catch (__err) {
      const err = asApiError(__err);
      setToggleError(err?.isNetworkError ? t('ui.HabitsScreen.unableToConnectThatChange') : t('ui.HabitsScreen.couldnTUpdateThatHabit'));
    }
  };

  const addHabit = async (name: string, description?: string) => {
    setError(null);
    try {
      await wellnessApi.createHabit({ name, description, frequency: 'daily' });
      setCustomName('');
      load();
    } catch (__err) {
      const err = asApiError(__err);
      if (err?.status === 403) {
        navigation.navigate('Paywall');
      } else {
        setError(err?.message ?? t('ui.HabitsScreen.couldNotAddHabit'));
      }
    }
  };

  const atLimit = tier === 'free' && habits.length >= maxFree;

  return (
    <PageContainer onRefresh={loadHabitsData}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>{t('ui.HabitsScreen.habits')}</Text>
      <Text variant="body" tone="secondary" style={{ marginBottom: spacing.lg }}>
        {tier === 'free' ? `Free plan: up to ${maxFree} active habits.` : 'Unlimited active habits.'}
      </Text>

      {loading && habits.length === 0 && <ListSkeleton />}

      {!loading && loadError && habits.length === 0 && <ErrorState onRetry={loadHabitsData} />}

      {!loading && loadError && habits.length > 0 && <ErrorBanner message={t('ui.HabitsScreen.couldnTRefreshYourHabits')} onRetry={loadHabitsData} />}

      {toggleError && <ErrorBanner message={toggleError} />}

      {!loading && !loadError && habits.length === 0 && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" tone="secondary">{t('ui.HabitsScreen.noHabitsYetAddOne')}</Text>
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
        <SectionHeader title={t('ui.HabitsScreen.addAHabit')} />
        <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder={t('ui.HabitsScreen.customHabitName')} accessibilityLabel={t('ui.HabitsScreen.customHabitName')}
            placeholderTextColor={color.textMuted}
            style={{ flex: 1, color: color.textPrimary }}
          />
          <Button label={t('ui.HabitsScreen.add')} size="sm" icon={Plus} disabled={!customName.trim() || atLimit} onPress={() => addHabit(customName.trim())} />
        </Card>
        {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}
        {atLimit && (
          <Card onPress={() => navigation.navigate('Paywall')}>
            <Text variant="bodySm" tone="accent">{t('ui.HabitsScreen.youVeReachedTheFree')}</Text>
          </Card>
        )}
        {!atLimit && predefined.length > 0 && (
          <Text variant="caption" tone="muted" style={{ marginBottom: spacing.xs }}>{t('ui.HabitsScreen.suggestions')}</Text>
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
