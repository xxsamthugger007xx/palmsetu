import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Info, Layers } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { RelationshipDailyReport } from '../../types/astrology';

export function AstrologyHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sharedHistory, setSharedHistory] = useState<RelationshipDailyReport[]>([]);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setState('loading');
      try {
        const rel = await astrologyApi.getMyRelationship();
        if (rel.relationship) {
          setRelationshipId(rel.relationship.id);
          const hist = await astrologyApi.getRelationshipHistory(rel.relationship.id);
          setSharedHistory(hist.items);
        }
        setState('ready');
      } catch {
        setState('error');
      }
    })();
  }, []);

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">Reading History</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' && <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text>}
      {state === 'error' && <EmptyState icon={Info} title="Couldn't load history" />}

      {state === 'ready' && (
        <>
          <SectionHeader title="Personal readings" />
          <Card>
            <Text variant="caption" tone="muted">
              Your personal daily readings are available from the Daily Cosmic Guidance home screen for
              today, and are private to you.
            </Text>
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Shared relationship readings" />
            {!relationshipId ? (
              <EmptyState icon={Layers} title="No partner connected" description="Connect with a partner to start building shared reading history." />
            ) : sharedHistory.length === 0 ? (
              <EmptyState icon={Layers} title="No shared readings yet" />
            ) : (
              sharedHistory.map((r) => (
                <Card
                  key={r.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('RelationshipReport', { relationshipId: relationshipId!, localDate: r.localDate })}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="semibold">{r.connectionTheme}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{new Date(r.localDate).toLocaleDateString()}</Text>
                  </View>
                  <ChevronRight size={16} color={color.textMuted} />
                </Card>
              ))
            )}
          </View>
        </>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
});
