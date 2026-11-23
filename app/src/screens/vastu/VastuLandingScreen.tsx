import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Compass as CompassIcon, Home, History, ChevronRight, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { vastuApi } from '../../services/vastuApi';
import { VastuReport } from '../../types/vastu';
import { useTranslation } from 'react-i18next';

export function VastuLandingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [recent, setRecent] = useState<VastuReport[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await vastuApi.getReports();
      setRecent(res.items.slice(0, 3));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <PageContainer onRefresh={load}>
      <View style={styles.header}>
        <Text variant="display" weight="semibold">{t('ui.VastuCompassScreen.vastuCompass')}</Text>
        <IconButton icon={History} onPress={() => navigation.navigate('VastuHistory')} />
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        {t('ui.VastuLandingScreen.alignYourSpaceTraditionalDirection')}
      </Text>

      <Card elevated onPress={() => navigation.navigate('VastuCompass')} style={{ marginBottom: spacing.md }}>
        <View style={styles.iconWrap}>
          <CompassIcon size={22} color={color.accent} strokeWidth={1.75} />
        </View>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.VastuLandingScreen.openTheCompass')}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
          {t('ui.VastuLandingScreen.findYourCurrentFacingDirection')}
        </Text>
      </Card>

      <Card onPress={() => navigation.navigate('VastuPropertyForm')}>
        <View style={styles.iconWrap}>
          <Home size={22} color={color.accent} strokeWidth={1.75} />
        </View>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.VastuLandingScreen.analyzeAProperty')}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
          {t('ui.VastuLandingScreen.addRoomDirectionsForA')}
        </Text>
      </Card>

      {state === 'ready' && recent.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.GemstoneLandingScreen.recentReports')}</Text>
          {recent.map((r) => (
            <Card key={r.id} style={styles.row} onPress={() => navigation.navigate('VastuReport', { reportId: r.id })}>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">{r.confirmedRoomCount} room{r.confirmedRoomCount !== 1 ? 's' : ''} analyzed</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              <ChevronRight size={16} color={color.textMuted} />
            </Card>
          ))}
        </View>
      )}

      {state === 'ready' && recent.length === 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState icon={Home} title={t('ui.GemstoneHistoryScreen.noReportsYet')} description={t('ui.VastuLandingScreen.analyzeAPropertyToSee')} />
        </View>
      )}

      <Card style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('ui.VastuLandingScreen.vastuIsATraditionalArchitectural')}
        </Text>
      </Card>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: color.accentMuted, alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
});
