import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Compass as CompassIcon, Home, History, ChevronRight, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FadeInUp } from '../../components/FadeInUp';
import { color, featureTint, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { vastuApi } from '../../services/vastuApi';
import { VastuReport } from '../../types/vastu';
import { useTranslation } from 'react-i18next';

const tint = featureTint.wellness; // shared green identity for vastu across the app (see DiscoverScreen's own module tints)

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
      <FadeInUp>
      <View style={styles.header}>
        <Text variant="display" weight="semibold">{t('ui.VastuCompassScreen.vastuCompass')}</Text>
        <IconButton icon={History} onPress={() => navigation.navigate('VastuHistory')} />
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        {t('ui.VastuLandingScreen.alignYourSpaceTraditionalDirection')}
      </Text>
      </FadeInUp>

      <FadeInUp delay={100}>
      <Card elevated onPress={() => navigation.navigate('VastuCompass')} style={{ marginBottom: spacing.md, borderColor: tint.soft }}>
        <View style={[styles.iconWrap, { backgroundColor: tint.soft }]}>
          <CompassIcon size={22} color={tint.solid} strokeWidth={1.75} />
        </View>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.VastuLandingScreen.openTheCompass')}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
          {t('ui.VastuLandingScreen.findYourCurrentFacingDirection')}
        </Text>
      </Card>

      <Card elevated onPress={() => navigation.navigate('VastuPropertyForm')} style={{ borderColor: tint.soft }}>
        <View style={[styles.iconWrap, { backgroundColor: tint.soft }]}>
          <Home size={22} color={tint.solid} strokeWidth={1.75} />
        </View>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.VastuLandingScreen.analyzeAProperty')}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs }}>
          {t('ui.VastuLandingScreen.addRoomDirectionsForA')}
        </Text>
      </Card>
      </FadeInUp>

      {state === 'ready' && recent.length > 0 && (
        <FadeInUp delay={200}>
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
        </FadeInUp>
      )}

      {state === 'ready' && recent.length === 0 && (
        <FadeInUp delay={200}>
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState icon={Home} title={t('ui.GemstoneHistoryScreen.noReportsYet')} description={t('ui.VastuLandingScreen.analyzeAPropertyToSee')} />
        </View>
        </FadeInUp>
      )}

      <FadeInUp delay={260}>
      <Card style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('ui.VastuLandingScreen.vastuIsATraditionalArchitectural')}
        </Text>
      </Card>
      </FadeInUp>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
});
