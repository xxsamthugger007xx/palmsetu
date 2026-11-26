import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gem, History, ChevronRight, Info, Sparkles, Crown } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FadeInUp } from '../../components/FadeInUp';
import { color, featureTint, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { gemstoneApi } from '../../services/gemstoneApi';
import { GemstoneReport } from '../../types/gemstone';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
import { ListSkeleton } from '../../components/ListSkeleton';
type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

const tint = featureTint.palm; // shared rose-gold identity for gemstone across the app (see DiscoverScreen's own module tints)

export function GemstoneLandingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [recent, setRecent] = useState<GemstoneReport[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      await astrologyApi.getProfile();
      const hist = await gemstoneApi.getHistory();
      setRecent(hist.items.slice(0, 3));
      setState('ready');
    } catch (__err) {
      const err = asApiError(__err);
      setState(err.status === 404 ? 'needsProfile' : 'error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state === 'loading') {
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer onRefresh={load}>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('ui.GemstoneLandingScreen.gemstoneGuide')}</Text>
        <EmptyState
          icon={Gem}
          title={t('ui.SoulEnergyReadingScreen.setUpYourBirthDetails')}
          description={t('ui.GemstoneLandingScreen.yourGemstoneRecommendationUsesThe')}
          actionLabel={t('ui.SoulEnergyReadingScreen.setUpBirthDetails')}
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return <PageContainer><EmptyState icon={Info} title={t('ui.AstrologyLandingScreen.couldnTLoadThisSection')} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer>
      <FadeInUp>
      <View style={styles.header}>
        <Text variant="display" weight="semibold">{t('ui.GemstoneLandingScreen.gemstoneGuide')}</Text>
        <IconButton icon={History} onPress={() => navigation.navigate('GemstoneHistory')} />
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        {t('ui.GemstoneLandingScreen.traditionalVedicGemstoneGuidanceBased')}
      </Text>
      </FadeInUp>

      <FadeInUp delay={100}>
      <Card elevated style={{ borderColor: tint.soft }}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: tint.soft }]}>
            <Gem size={22} color={tint.solid} strokeWidth={1.75} />
          </View>
          <View style={styles.premiumBadge}>
            <Crown size={12} color={color.gold} strokeWidth={2} />
            <Text variant="caption" weight="semibold" style={{ color: color.gold, marginLeft: 4 }}>{t('common.premium')}</Text>
          </View>
        </View>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.GemstoneLandingScreen.yourPersonalGemstoneGuide')}</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
          {t('ui.GemstoneLandingScreen.discoverTheGemstoneTraditionallyAssociated')}
        </Text>
        <Button label={t('ui.GemstoneLandingScreen.getMyGemstoneGuide')} icon={Sparkles} onPress={() => navigation.navigate('GemstoneGoal')} />
      </Card>
      </FadeInUp>

      {recent.length > 0 && (
        <FadeInUp delay={200}>
        <View style={{ marginTop: spacing.xl }}>
          <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>{t('ui.GemstoneLandingScreen.recentReports')}</Text>
          {recent.map((r) => (
            <Card key={r.id} style={styles.row} onPress={() => navigation.navigate('GemstoneReport', { reportId: r.id })}>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">{r.primary.gemstone?.nameEnglish ?? 'No recommendation'}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              <ChevronRight size={16} color={color.textMuted} />
            </Card>
          ))}
        </View>
        </FadeInUp>
      )}

      <FadeInUp delay={260}>
      <Card style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('ui.GemstoneLandingScreen.basedOnTheRashiMoon')}
        </Text>
      </Card>
      </FadeInUp>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: 'rgba(232, 184, 92, 0.12)',
    borderWidth: 1, borderColor: 'rgba(232, 184, 92, 0.3)',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
});
