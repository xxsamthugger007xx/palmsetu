import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Lock, Info } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { SpreadDefinition } from '../../types/tarot';

type LoadState = 'loading' | 'ready' | 'error';

export function TarotSpreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotSpread'>>();
  const { category, question } = route.params;

  const [state, setState] = useState<LoadState>('loading');
  const [spreads, setSpreads] = useState<SpreadDefinition[]>([]);
  const [selected, setSelected] = useState<SpreadDefinition | null>(null);
  const [tier, setTier] = useState<'free' | 'premium'>('free');

  useEffect(() => {
    (async () => {
      setState('loading');
      try {
        const [spreadsRes, limitsRes] = await Promise.all([tarotApi.getSpreads(), tarotApi.getLimits()]);
        setSpreads(spreadsRes.spreads);
        setTier(limitsRes.tier);
        setState('ready');
      } catch {
        setState('error');
      }
    })();
  }, []);

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.xl }}>Loading spreads...</Text>
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <EmptyState icon={Info} title="Couldn't load spreads" description="Check your connection and try again." actionLabel="Back" onAction={() => navigation.goBack()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>Choose a spread</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Each position has its own meaning - shown below once you select a spread.
      </Text>

      {spreads.filter((s) => s.available).map((spread) => {
        const locked = spread.premium && tier !== 'premium';
        const isSelected = selected?.id === spread.id;
        return (
          <Card
            key={spread.id}
            elevated={isSelected}
            style={[styles.spreadCard, isSelected && styles.spreadCardSelected]}
            onPress={() => setSelected(spread)}
          >
            <View style={styles.spreadTop}>
              <Text variant="bodySm" weight="semibold">{spread.title}</Text>
              {locked && (
                <View style={styles.lockBadge}>
                  <Lock size={11} color={color.textMuted} strokeWidth={2} />
                  <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>Premium</Text>
                </View>
              )}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{spread.description}</Text>

            {isSelected && (
              <View style={{ marginTop: spacing.sm }}>
                {spread.positions.map((p) => (
                  <View key={p.index} style={styles.positionRow}>
                    <Text variant="caption" tone="accent" weight="semibold" style={{ width: 90 }}>{p.name}</Text>
                    <Text variant="caption" tone="muted" style={{ flex: 1 }}>{p.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      <Button
        label={selected?.premium && tier !== 'premium' ? 'Upgrade to use this spread' : 'Shuffle and draw'}
        fullWidth
        disabled={!selected}
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          if (!selected) return;
          if (selected.premium && tier !== 'premium') {
            navigation.navigate('Paywall');
            return;
          }
          navigation.navigate('TarotDraw', { category, question, spreadType: selected.id });
        }}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  spreadCard: { marginBottom: spacing.sm },
  spreadCardSelected: { borderColor: color.accentBorder },
  spreadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: color.surfaceElevated, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  positionRow: { flexDirection: 'row', paddingVertical: 4 },
});
