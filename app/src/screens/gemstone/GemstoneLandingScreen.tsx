import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gem, History, ChevronRight, Info, Sparkles } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { gemstoneApi } from '../../services/gemstoneApi';
import { GemstoneReport } from '../../types/gemstone';

type LoadState = 'loading' | 'needsProfile' | 'ready' | 'error';

export function GemstoneLandingScreen() {
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
    } catch (err: any) {
      setState(err.status === 404 ? 'needsProfile' : 'error');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (state === 'loading') {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl, textAlign: 'center' }}>Loading...</Text></PageContainer>;
  }

  if (state === 'needsProfile') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Gemstone Guide</Text>
        <EmptyState
          icon={Gem}
          title="Set up your birth details first"
          description="Your gemstone recommendation uses the same birth chart as Daily Cosmic Guidance."
          actionLabel="Set up birth details"
          onAction={() => navigation.navigate('AstrologyProfileSetup')}
        />
      </PageContainer>
    );
  }

  if (state === 'error') {
    return <PageContainer><EmptyState icon={Info} title="Couldn't load this section" actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <Text variant="display" weight="semibold">Gemstone Guide</Text>
        <IconButton icon={History} onPress={() => navigation.navigate('GemstoneHistory')} />
      </View>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: 4, marginBottom: spacing.lg }}>
        Traditional Vedic gemstone guidance based on your birth chart, for reflection, not a scientific prescription.
      </Text>

      <Card elevated>
        <View style={styles.iconWrap}>
          <Gem size={22} color={color.accent} strokeWidth={1.75} />
        </View>
        <Text variant="subtitle" weight="semibold" style={{ marginTop: spacing.md }}>Your Personal Gemstone Guide</Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
          Discover the gemstone traditionally associated with your Moon sign's ruling planet, with wearing
          guidance, alternatives, and a buying guide.
        </Text>
        <Button label="Get my gemstone guide" icon={Sparkles} onPress={() => navigation.navigate('GemstoneGoal')} />
      </Card>

      {recent.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing.sm }}>Recent reports</Text>
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
      )}

      <Card style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-start' }}>
        <Info size={14} color={color.textMuted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text variant="caption" tone="muted" style={{ marginLeft: spacing.sm, flex: 1 }}>
          Based on the Rashi (Moon-sign) lord strengthening convention, one documented Vedic tradition among
          several. This does not perform full ascendant or planetary-affliction analysis.
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
