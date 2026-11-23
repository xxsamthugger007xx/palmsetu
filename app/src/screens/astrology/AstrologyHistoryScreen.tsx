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
import { parseLocalDateString } from '../../utils/formatDate';
import { useTranslation } from 'react-i18next';

export function AstrologyHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sharedHistory, setSharedHistory] = useState<RelationshipDailyReport[]>([]);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);

  const load = React.useCallback(async () => {
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('ui.AstrologyHistoryScreen.readingHistory')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' && <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>{t('ui.AstrologyHistoryScreen.loading')}</Text>}
      {state === 'error' && <EmptyState icon={Info} title={t('ui.AstrologyHistoryScreen.couldnTLoadHistory')} />}

      {state === 'ready' && (
        <>
          <SectionHeader title={t('ui.AstrologyHistoryScreen.personalReadings')} />
          <Card>
            <Text variant="caption" tone="muted">
              {t('ui.AstrologyHistoryScreen.yourPersonalDailyReadingsAre')}
            </Text>
          </Card>

          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title={t('ui.AstrologyHistoryScreen.sharedRelationshipReadings')} />
            {!relationshipId ? (
              <EmptyState icon={Layers} title={t('ui.AstrologyHistoryScreen.noPartnerConnected')} description={t('ui.AstrologyHistoryScreen.connectWithAPartnerTo')} />
            ) : sharedHistory.length === 0 ? (
              <EmptyState icon={Layers} title={t('ui.AstrologyHistoryScreen.noSharedReadingsYet')} />
            ) : (
              sharedHistory.map((r) => (
                <Card
                  key={r.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('RelationshipReport', { relationshipId: relationshipId!, localDate: r.localDate })}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="semibold">{r.connectionTheme}</Text>
                    <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{parseLocalDateString(r.localDate).toLocaleDateString()}</Text>
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
