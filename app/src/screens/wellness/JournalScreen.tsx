import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Search, Star } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { wellnessApi, JournalEntry } from '../../services/wellnessApi';

export function JournalScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [favoriteOnly, setFavoriteOnly] = React.useState(false);
  const [streak, setStreak] = React.useState<{ hasData: boolean; currentStreak: number; message?: string } | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    wellnessApi.listJournalEntries({ q: query || undefined, favoriteOnly: favoriteOnly || undefined })
      .then((res) => setEntries(res.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [query, favoriteOnly]);

  useFocusEffect(React.useCallback(() => {
    load();
    wellnessApi.getJournalStreak().then(setStreak).catch(() => setStreak(null));
  }, [load]));

  return (
    <PageContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="display" weight="semibold">Journal</Text>
        <Button label="New entry" icon={Plus} size="sm" onPress={() => navigation.navigate('JournalEditor', {})} />
      </View>

      {streak && (
        <Card elevated style={{ marginBottom: spacing.lg }}>
          <Text variant="bodySm" weight="semibold">
            {streak.hasData ? `${streak.currentStreak}-day writing streak` : 'No entries yet'}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            {streak.hasData
              ? 'Every entry counts, no pressure if a day is missed.'
              : streak.message ?? 'Write whenever feels right - there is no pressure to keep a streak.'}
          </Text>
        </Card>
      )}

      <Card style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
        <Search size={14} color={color.textMuted} strokeWidth={1.75} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={load}
          placeholder="Search entries"
          placeholderTextColor={color.textMuted}
          style={{ flex: 1, marginLeft: spacing.sm, color: color.textPrimary }}
        />
        <Pressable onPress={() => setFavoriteOnly((v) => !v)} hitSlop={8}>
          <Star size={16} color={favoriteOnly ? color.accent : color.textMuted} strokeWidth={1.75} fill={favoriteOnly ? color.accent : 'transparent'} />
        </Pressable>
      </Card>

      {!loading && entries.length === 0 && (
        <Card>
          <Text variant="bodySm" tone="secondary">No journal entries yet. Start with a prompt or free write.</Text>
        </Card>
      )}

      {entries.map((entry) => (
        <Card key={entry.id} onPress={() => navigation.navigate('JournalEditor', { entryId: entry.id })} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label" tone="muted">{entry.type.replace(/-/g, ' ').toUpperCase()}</Text>
            {entry.favorite && <Star size={13} color={color.accent} fill={color.accent} />}
          </View>
          <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.xs }}>
            {entry.title || entry.content.slice(0, 60)}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            {new Date(entry.createdAt).toLocaleDateString()}
          </Text>
        </Card>
      ))}
    </PageContainer>
  );
}
