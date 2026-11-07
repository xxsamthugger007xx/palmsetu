import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Info, ScanLine, Trash2 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { palmApi } from '../../services/palmApi';
import { PalmReading } from '../../types/palm';

export function PalmHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<PalmReading[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = async () => {
    setState('loading');
    try {
      const res = await palmApi.listReadings();
      setItems(res.items);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Delete reading', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await palmApi.deleteReading(id);
            setItems((prev) => prev.filter((r) => r.id !== id));
          } catch {
            Alert.alert('Could not delete this reading. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Palm Reading History</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' && (
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text>
      )}

      {state === 'error' && (
        <EmptyState icon={Info} title="Couldn't load history" actionLabel="Retry" onAction={load} />
      )}

      {state === 'ready' && items.length === 0 && (
        <EmptyState
          icon={ScanLine}
          title="No palm readings yet"
          description="Your past palm scans will appear here."
          actionLabel="Scan your palm"
          onAction={() => navigation.navigate('PalmCapture')}
        />
      )}

      {state === 'ready' && items.map((r) => {
        // Defensive against any reading saved under a previous schema version
        // (e.g. before a palmistry engine rebuild) - render a safe fallback
        // row instead of crashing on a missing field.
        const hand = r.analysis?.hand;
        const sectionCount = r.freeReading?.sections?.length;
        const limitedVisibility = r.freeReading?.limitedVisibility;
        return (
          <Card key={r.id} style={styles.row} onPress={() => navigation.navigate('PalmReport', { readingId: r.id })}>
            <View style={{ flex: 1 }}>
              <Text variant="bodySm" weight="semibold">
                {hand === 'left' || hand === 'right' ? `${hand === 'left' ? 'Left' : 'Right'} hand reading` : 'Palm reading'}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {new Date(r.createdAt).toLocaleDateString()}
                {sectionCount != null ? ` · ${sectionCount} section${sectionCount === 1 ? '' : 's'}` : ''}
                {limitedVisibility ? ' · limited visibility' : ''}
              </Text>
            </View>
            <IconButton icon={Trash2} onPress={() => handleDelete(r.id)} tone={color.danger} />
            <ChevronRight size={16} color={color.textMuted} />
          </Card>
        );
      })}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
});
