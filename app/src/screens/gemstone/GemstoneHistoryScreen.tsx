import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Bookmark, Gem, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { gemstoneApi } from '../../services/gemstoneApi';
import { GemstoneReport } from '../../types/gemstone';

export function GemstoneHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<GemstoneReport[]>([]);

  const load = async () => {
    setState('loading');
    try {
      const res = await gemstoneApi.getHistory();
      setItems(res.items);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Gemstone Reports</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' && <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text>}
      {state === 'error' && <EmptyState icon={Info} title="Couldn't load reports" actionLabel="Retry" onAction={load} />}
      {state === 'ready' && items.length === 0 && (
        <EmptyState icon={Gem} title="No reports yet" description="Your gemstone reports will appear here." />
      )}

      {state === 'ready' && items.map((r) => (
        <Card key={r.id} style={styles.row} onPress={() => navigation.navigate('GemstoneReport', { reportId: r.id })}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="bodySm" weight="semibold">{r.primary.gemstone?.nameEnglish ?? 'No recommendation'}</Text>
              {r.saved && <Bookmark size={13} color={color.accent} strokeWidth={2} style={{ marginLeft: spacing.xs }} />}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString()}</Text>
          </View>
          <ChevronRight size={16} color={color.textMuted} />
        </Card>
      ))}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
});
