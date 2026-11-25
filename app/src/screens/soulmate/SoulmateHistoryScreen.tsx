import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Info, Pencil, Trash2, Clock } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { soulmateApi } from '../../services/soulmateApi';
import { SoulmateSketch } from '../../types/soulmate';
import { useTranslation } from 'react-i18next';
import { ListSkeleton } from '../../components/ListSkeleton';

function statusBadge(status: SoulmateSketch['generationStatus']): { label: string; status: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (status === 'completed') return { label: 'Completed', status: 'success' };
  if (status === 'failed') return { label: 'Failed', status: 'danger' };
  if (status === 'generating') return { label: 'Generating', status: 'warning' };
  return { label: 'Awaiting payment', status: 'neutral' };
}

export function SoulmateHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<SoulmateSketch[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = React.useCallback(async () => {
    setState('loading');
    try {
      const res = await soulmateApi.listSketches();
      setItems(res.items);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (id: string) => {
    Alert.alert(t('ui.SoulmateHistoryScreen.deleteSketch'), t('ui.AssistantHistoryScreen.thisCannotBeUndone'), [
      { text: t('ui.AssistantHistoryScreen.cancel'), style: 'cancel' },
      {
        text: t('ui.AssistantHistoryScreen.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await soulmateApi.deleteSketch(id);
            setItems((prev) => prev.filter((s) => s.id !== id));
          } catch {
            Alert.alert(t('ui.SoulmateHistoryScreen.couldNotDeleteThisSketch'));
          }
        },
      },
    ]);
  };

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('ui.SoulmateHistoryScreen.soulmateSketchHistory')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' && (
        <ListSkeleton rows={3} />
      )}

      {state === 'error' && (
        <EmptyState icon={Info} title={t('ui.AstrologyHistoryScreen.couldnTLoadHistory')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} />
      )}

      {state === 'ready' && items.length === 0 && (
        <EmptyState
          icon={Pencil}
          title={t('ui.SoulmateHistoryScreen.noSketchesYet')}
          description={t('ui.SoulmateHistoryScreen.yourPurchasedSoulmateSketchesWill')}
          actionLabel={t('ui.SoulmateHistoryScreen.createASketch')}
          onAction={() => navigation.navigate('SoulmateIntro')}
        />
      )}

      {state === 'ready' && items.map((s) => {
        const badge = statusBadge(s.generationStatus);
        const onPress = () => {
          if (s.generationStatus === 'completed') navigation.navigate('SoulmateResult', { sketchId: s.id });
          else if (s.generationStatus === 'payment_verified' || s.generationStatus === 'failed') navigation.navigate('SoulmateGenerating', { sketchId: s.id });
        };
        return (
          <Card key={s.id} style={styles.row} onPress={onPress}>
            <Clock size={16} color={color.textMuted} strokeWidth={1.75} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="bodySm" weight="semibold">{new Date(s.createdAt).toLocaleDateString()}</Text>
              <View style={{ marginTop: 4 }}>
                <StatusBadge label={badge.label} status={badge.status} />
              </View>
            </View>
            <IconButton icon={Trash2} onPress={() => handleDelete(s.id)} tone={color.danger} />
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
