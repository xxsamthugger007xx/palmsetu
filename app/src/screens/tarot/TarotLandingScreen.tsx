import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { History, Info, Layers, Heart, Briefcase, Compass as CompassIcon, MessageCircleQuestion, Lock, ChevronRight } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TarotCardFace } from '../../components/TarotCardFace';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { DailyTarot, TarotCard as TarotCardType, TarotReading } from '../../types/tarot';

type LoadState = 'loading' | 'ready' | 'error';

const categoryTiles: {
  id: string;
  title: string;
  description: string;
  icon: typeof Layers;
  premium: boolean;
  comingSoon?: boolean;
  presetCategory?: 'love' | 'career' | 'general' | 'question';
}[] = [
  { id: 'one-card', title: 'One-card reading', description: 'A quick, focused draw', icon: Layers, premium: false, presetCategory: 'general' },
  { id: 'three-card', title: 'Three-card reading', description: 'Past, present, future', icon: Layers, premium: true, presetCategory: 'general' },
  { id: 'love', title: 'Love & relationships', description: 'Reflect on connection', icon: Heart, premium: true, presetCategory: 'love' },
  { id: 'career', title: 'Career & growth', description: 'Reflect on direction', icon: Briefcase, premium: true, presetCategory: 'career' },
  { id: 'general', title: 'General guidance', description: 'Open reflection', icon: CompassIcon, premium: false, presetCategory: 'general' },
  { id: 'celtic-cross', title: 'Celtic Cross', description: 'Advanced 10-card spread', icon: MessageCircleQuestion, premium: true, presetCategory: 'general' },
  { id: 'yes-no', title: 'Yes / No', description: 'A quick directional read', icon: CompassIcon, premium: false, presetCategory: 'question' },
  { id: 'relationship-compatibility', title: 'Compatibility', description: 'You, them, and what connects you', icon: Heart, premium: true, presetCategory: 'love' },
];

export function TarotLandingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [daily, setDaily] = useState<{ daily: DailyTarot; reading: TarotReading } | null>(null);
  const [cardsById, setCardsById] = useState<Record<string, TarotCardType>>({});
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<TarotReading[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [dailyRes, catalogueRes, historyRes] = await Promise.all([
        tarotApi.getDailyCard(),
        tarotApi.getCatalogue(),
        tarotApi.getHistory(1, 5),
      ]);
      setDaily(dailyRes);
      setCardsById(Object.fromEntries(catalogueRes.cards.map((c) => [c.id, c])));
      setHistory(historyRes.items);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>Tarot</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.lg }}>Loading...</Text>
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Tarot</Text>
        <EmptyState
          icon={Info}
          title="Couldn't load Tarot"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={load}
        />
      </PageContainer>
    );
  }

  const dailyCard = daily ? cardsById[daily.daily.cardId] : undefined;

  return (
    <PageContainer>
      <View style={styles.header}>
        <View>
          <Text variant="display" weight="semibold">Tarot</Text>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>Explore the cards. Reflect on your path.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <IconButton icon={Info} onPress={() => {}} />
          <IconButton icon={History} onPress={() => navigation.navigate('TarotHistory')} />
        </View>
      </View>

      <Card elevated style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        <Text variant="label" tone="muted" style={{ alignSelf: 'flex-start' }}>DAILY CARD</Text>
        <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
          <TarotCardFace card={dailyCard} orientation={daily?.daily.orientation} faceDown={!revealed} width={140} height={210} />
        </View>

        {!revealed ? (
          <Button label="Reveal my card" onPress={() => setRevealed(true)} />
        ) : dailyCard ? (
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text variant="subtitle" weight="semibold">{dailyCard.name}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.sm }}>
              {daily?.daily.orientation === 'reversed' ? 'Reversed' : 'Upright'}
            </Text>
            <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
              {daily?.daily.orientation === 'reversed' ? dailyCard.reversedGeneral : dailyCard.general}
            </Text>
            <Text variant="bodySm" tone="accent" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              {dailyCard.reflectionPrompt}
            </Text>
            <Button
              label="Open full reading"
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md }}
              onPress={() => daily && navigation.navigate('TarotReport', { readingId: daily.daily.readingId })}
            />
          </View>
        ) : null}
      </Card>

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="Reading categories" />
        <View style={styles.grid}>
          {categoryTiles.map((tile) => (
            <Card
              key={tile.id}
              style={styles.tile}
              onPress={() =>
                tile.comingSoon
                  ? undefined
                  : navigation.navigate('TarotCategory', { presetCategory: tile.presetCategory })
              }
            >
              <View style={styles.tileTop}>
                <View style={styles.tileIcon}>
                  <tile.icon size={18} color={color.accent} strokeWidth={1.75} />
                </View>
                {tile.premium && (
                  <View style={styles.premiumBadge}>
                    <Lock size={10} color={color.textMuted} strokeWidth={2} />
                  </View>
                )}
              </View>
              <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{tile.title}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {tile.comingSoon ? 'Coming soon' : tile.description}
              </Text>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="Recent readings" action={history.length > 0 ? 'View all' : undefined} onActionPress={() => navigation.navigate('TarotHistory')} />
        {history.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No readings yet"
            description="Start with a one-card draw to see your first reading here."
            actionLabel="Start a reading"
            onAction={() => navigation.navigate('TarotCategory', undefined)}
          />
        ) : (
          history.map((r) => (
            <Card key={r.id} style={styles.historyRow} onPress={() => navigation.navigate('TarotReport', { readingId: r.id })}>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">{r.spreadType.replace(/-/g, ' ')}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {new Date(r.createdAt).toLocaleDateString()} · {r.draws.length} card{r.draws.length > 1 ? 's' : ''}
                </Text>
              </View>
              <ChevronRight size={16} color={color.textMuted} />
            </Card>
          ))
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '47%',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: color.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
