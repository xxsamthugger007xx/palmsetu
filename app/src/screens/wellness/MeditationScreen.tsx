import React from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Moon, Lock, RefreshCw, Clock } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, MeditationContent, MeditationCategory } from '../../services/wellnessApi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_LABELS: Record<MeditationCategory, string> = {
  morning: 'Morning',
  sleep: 'Sleep',
  'stress-relief': 'Stress Relief',
  focus: 'Focus',
  mindfulness: 'Mindfulness',
  confidence: 'Confidence',
  gratitude: 'Gratitude',
  relaxation: 'Relaxation',
  'body-awareness': 'Body Awareness',
  'emotional-reset': 'Emotional Reset',
  'sleep-sounds': 'Sleep Sounds',
};

export function MeditationScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<MeditationContent[]>([]);
  const [recentIds, setRecentIds] = React.useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = React.useState<string[]>([]);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    wellnessApi.getMeditationCatalogue()
      .then((res) => setItems(res.items))
      .catch((err: any) => setError(err.message ?? 'Could not load meditation content. Please try again.'))
      .finally(() => setLoading(false));
    wellnessApi.getRecentMeditation().then((res) => setRecentIds(res.sessions.map((s) => s.contentId))).catch(() => setRecentIds([]));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const byCategory = React.useMemo(() => {
    const map = new Map<MeditationCategory, MeditationContent[]>();
    items.forEach((item) => {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [items]);

  const recent = items.filter((i) => recentIds.includes(i.id)).slice(0, 5);

  if (loading) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Meditation & Sleep</Text>
        <Text variant="bodySm" tone="muted">Loading...</Text>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Meditation & Sleep</Text>
        <EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Meditation & Sleep</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Guided sessions and ambient sounds, organized by what you need right now.
      </Text>

      {recent.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title="Recently played" />
          {recent.map((item) => (
            <MeditationRow key={item.id} item={item} onPress={() => navigation.navigate('MeditationPlayer', { contentId: item.id })} />
          ))}
        </View>
      )}

      {Array.from(byCategory.entries()).map(([category, catItems]) => (
        <View key={category} style={{ marginBottom: spacing.lg }}>
          <SectionHeader title={CATEGORY_LABELS[category] ?? category} />
          {catItems.map((item) => (
            <MeditationRow key={item.id} item={item} onPress={() => navigation.navigate('MeditationPlayer', { contentId: item.id })} />
          ))}
        </View>
      ))}

      {items.length === 0 && (
        <EmptyState icon={Moon} title="No content available" description="Please try again later." />
      )}
    </PageContainer>
  );
}

function MeditationRow({ item, onPress }: { item: MeditationContent; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Moon size={16} color={color.accent} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <View style={{ marginLeft: spacing.sm, flex: 1 }}>
          <Text variant="bodySm" weight="semibold">{item.title}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{item.description}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
            <Clock size={11} color={color.textMuted} strokeWidth={1.75} />
            <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>{item.durationMinutes} min</Text>
          </View>
        </View>
        {item.premium && <Lock size={14} color={color.textMuted} strokeWidth={1.75} />}
      </View>
    </Card>
  );
}
