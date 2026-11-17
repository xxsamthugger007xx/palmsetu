import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Bookmark, Info, Layers, Search, X } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { ReadingCategory, TarotReading, formatSpreadLabel } from '../../types/tarot';

const PAGE_SIZE = 10;

const CATEGORY_FILTERS: { id: ReadingCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'love', label: 'Love' },
  { id: 'career', label: 'Career' },
  { id: 'question', label: 'Question' },
];

export function TarotHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<TarotReading[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [savedOnly, setSavedOnly] = useState(false);
  const [category, setCategory] = useState<ReadingCategory | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (p: number, saved: boolean, cat: ReadingCategory | 'all', q: string) => {
    setState('loading');
    try {
      const res = await tarotApi.getHistory(p, PAGE_SIZE, { saved, category: cat === 'all' ? undefined : cat, q: q || undefined });
      setItems(res.items);
      setPage(res.page);
      setTotal(res.total);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load(1, savedOnly, category, search);
  }, [savedOnly, category, search]);

  // Debounced so typing doesn't fire a request per keystroke - 350ms is
  // short enough to feel responsive while avoiding a request storm.
  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(text.trim()), 350);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

  return (
    <PageContainer onRefresh={() => load(page, savedOnly, category, search)}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Reading History</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <Search size={15} color={color.textMuted} strokeWidth={1.75} />
        <TextInput
          value={searchInput}
          onChangeText={handleSearchChange}
          placeholder="Search questions, cards, reports..."
          placeholderTextColor={color.textMuted}
          style={styles.searchInput}
        />
        {searchInput.length > 0 && (
          <IconButton icon={X} size={14} onPress={() => { setSearchInput(''); setSearch(''); }} />
        )}
      </View>

      <View style={styles.filterRow}>
        <Card
          elevated={savedOnly}
          style={[styles.savedToggle, savedOnly && styles.savedToggleActive]}
          onPress={() => setSavedOnly((s) => !s)}
        >
          <Bookmark size={13} color={savedOnly ? tarotColor.gold : color.textMuted} strokeWidth={2} />
          <Text variant="caption" weight="semibold" style={{ marginLeft: spacing.xs, color: savedOnly ? tarotColor.gold : color.textSecondary }}>
            Saved only
          </Text>
        </Card>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }} contentContainerStyle={{ gap: spacing.xs }}>
        {CATEGORY_FILTERS.map((c) => {
          const active = category === c.id;
          return (
            <Card
              key={c.id}
              elevated={active}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setCategory(c.id)}
            >
              <Text variant="caption" weight="semibold" style={{ color: active ? tarotColor.gold : color.textSecondary }}>{c.label}</Text>
            </Card>
          );
        })}
      </ScrollView>

      {state === 'loading' && (
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text>
      )}

      {state === 'error' && (
        <EmptyState icon={Info} title="Couldn't load history" actionLabel="Retry" onAction={() => load(page, savedOnly, category, search)} />
      )}

      {state === 'ready' && items.length === 0 && (
        <EmptyState
          icon={Layers}
          title={search ? 'No matching readings' : 'No readings yet'}
          description={
            search
              ? `Nothing matched "${search}".`
              : savedOnly ? 'You have not saved any readings yet.' : 'Your tarot readings will appear here.'
          }
          actionLabel={search ? undefined : 'Start a reading'}
          onAction={search ? undefined : () => navigation.navigate('TarotCategory', undefined)}
        />
      )}

      {state === 'ready' && items.map((r) => (
        <Card key={r.id} style={styles.row} onPress={() => navigation.navigate('TarotReport', { readingId: r.id })}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodySm" weight="semibold">{formatSpreadLabel(r.spreadType)}</Text>
              {r.saved && <Bookmark size={13} color={tarotColor.gold} strokeWidth={2} style={{ marginLeft: spacing.xs }} />}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {new Date(r.createdAt).toLocaleDateString()} · {r.draws.length} card{r.draws.length > 1 ? 's' : ''} · {r.readingType}
            </Text>
          </View>
          <ChevronRight size={16} color={color.textMuted} />
        </Card>
      ))}

      {state === 'ready' && items.length > 0 && (
        <View style={styles.pagination}>
          <Button label="Previous" variant="secondary" size="sm" disabled={!hasPrev} onPress={() => load(page - 1, savedOnly, category, search)} />
          <Text variant="caption" tone="muted">Page {page}</Text>
          <Button label="Next" variant="secondary" size="sm" disabled={!hasNext} onPress={() => load(page + 1, savedOnly, category, search)} />
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginLeft: spacing.xs,
    color: color.textPrimary,
  },
  filterRow: { flexDirection: 'row', marginTop: spacing.md },
  savedToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  savedToggleActive: { borderColor: tarotColor.goldMuted },
  categoryChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  categoryChipActive: { borderColor: tarotColor.goldMuted },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
});
