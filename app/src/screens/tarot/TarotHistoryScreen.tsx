import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Bookmark, Info, Layers } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { TarotReading } from '../../types/tarot';

const PAGE_SIZE = 10;

export function TarotHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<TarotReading[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = async (p: number) => {
    setState('loading');
    try {
      const res = await tarotApi.getHistory(p, PAGE_SIZE);
      setItems(res.items);
      setPage(res.page);
      setTotal(res.total);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Reading History</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' && (
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text>
      )}

      {state === 'error' && (
        <EmptyState icon={Info} title="Couldn't load history" actionLabel="Retry" onAction={() => load(page)} />
      )}

      {state === 'ready' && items.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No readings yet"
          description="Your tarot readings will appear here."
          actionLabel="Start a reading"
          onAction={() => navigation.navigate('TarotCategory', undefined)}
        />
      )}

      {state === 'ready' && items.map((r) => (
        <Card key={r.id} style={styles.row} onPress={() => navigation.navigate('TarotReport', { readingId: r.id })}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodySm" weight="semibold">{r.spreadType.replace(/-/g, ' ')}</Text>
              {r.saved && <Bookmark size={13} color={color.accent} strokeWidth={2} style={{ marginLeft: spacing.xs }} />}
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
          <Button label="Previous" variant="secondary" size="sm" disabled={!hasPrev} onPress={() => load(page - 1)} />
          <Text variant="caption" tone="muted">Page {page}</Text>
          <Button label="Next" variant="secondary" size="sm" disabled={!hasNext} onPress={() => load(page + 1)} />
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
});
