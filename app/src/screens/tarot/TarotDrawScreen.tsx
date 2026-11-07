import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Sparkles, Info, RotateCcw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TarotCardFace } from '../../components/TarotCardFace';
import { FlippableTarotTile } from '../../components/FlippableTarotTile';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { TarotCard, TarotReading } from '../../types/tarot';

type Stage = 'loading' | 'shuffling' | 'selecting' | 'error' | 'limited';

// Enough tiles to feel like browsing a real deck without rendering all 78
// (which would hurt scroll performance for no visible benefit, since only
// a handful are ever interacted with per reading).
const DECK_VISUAL_SIZE = 21;
const TILE_ROTATIONS = [-6, 4, -2, 7, -8, 3, -4, 6, -3, 5];

export function TarotDrawScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotDraw'>>();
  const { category, question, spreadType } = route.params;

  const [stage, setStage] = useState<Stage>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [cardsById, setCardsById] = useState<Record<string, TarotCard>>({});
  const [tappedTileIndices, setTappedTileIndices] = useState<number[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const shuffleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [startRes, catalogueRes] = await Promise.all([
          tarotApi.startReading(category, spreadType, question ?? undefined),
          tarotApi.getCatalogue(),
        ]);
        setCardsById(Object.fromEntries(catalogueRes.cards.map((c) => [c.id, c])));

        if ('crisisFlag' in startRes && startRes.crisisFlag) {
          setErrorMessage(startRes.message);
          setStage('error');
          return;
        }

        setReading(startRes as TarotReading);
        runShuffle();
      } catch (err: any) {
        if (err.status === 403) {
          setErrorMessage(err.message);
          setStage('limited');
        } else {
          setErrorMessage('Something went wrong starting your reading.');
          setStage('error');
        }
      }
    })();
  }, []);

  const runShuffle = () => {
    setStage('shuffling');
    if (reduceMotion) {
      setStage('selecting');
      return;
    }
    Animated.sequence([
      Animated.timing(shuffleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(shuffleAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setStage('selecting'));
  };

  const needed = reading?.draws.length ?? 0;
  const revealedCount = tappedTileIndices.length;
  const allRevealed = reading !== null && revealedCount >= needed;

  const handleTilePress = (tileIndex: number) => {
    if (!reading || tappedTileIndices.includes(tileIndex) || revealedCount >= needed) return;
    setTappedTileIndices((prev) => [...prev, tileIndex]);
  };

  const handleRestart = () => setTappedTileIndices([]);

  const tileRotation = useMemo(
    () => (i: number) => `${TILE_ROTATIONS[i % TILE_ROTATIONS.length]}deg`,
    []
  );

  if (stage === 'loading' || stage === 'shuffling') {
    return (
      <PageContainer scroll={false}>
        <View style={styles.center}>
          <Animated.View
            style={{
              transform: [{ rotate: shuffleAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '12deg'] }) }],
            }}
          >
            <TarotCardFace faceDown width={140} height={210} />
          </Animated.View>
          <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.lg }}>
            {stage === 'loading' ? 'Preparing your cards...' : 'Shuffling...'}
          </Text>
        </View>
      </PageContainer>
    );
  }

  if (stage === 'limited' || stage === 'error') {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title={stage === 'limited' ? 'Reading limit reached' : 'Something went wrong'}
          description={errorMessage ?? undefined}
          actionLabel={stage === 'limited' ? 'View Premium' : 'Go back'}
          onAction={() => (stage === 'limited' ? navigation.navigate('Paywall') : navigation.goBack())}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer scroll={false}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        {revealedCount > 0 && !allRevealed && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon={RotateCcw} onPress={handleRestart} tone={color.textMuted} />
          </View>
        )}
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
        {allRevealed ? 'Your cards' : 'Choose your cards'}
      </Text>
      <Text variant="caption" tone="accent" weight="semibold" style={{ marginTop: 4, textAlign: 'center' }}>
        {revealedCount} of {needed} selected
      </Text>

      {/* Selection tray: fills in as each position is chosen */}
      <View style={styles.tray}>
        {reading?.draws.map((draw, i) => {
          const isRevealed = i < revealedCount;
          const card = cardsById[draw.cardId];
          return (
            <View key={draw.positionIndex} style={styles.trayItem}>
              <Text variant="caption" tone="muted" numberOfLines={1}>{draw.positionName}</Text>
              <View style={styles.trayCard}>
                {isRevealed ? (
                  <TarotCardFace card={card} orientation={draw.orientation} width={56} height={86} />
                ) : (
                  <TarotCardFace faceDown width={56} height={86} dimmed />
                )}
              </View>
              {isRevealed && (
                <Text variant="caption" weight="semibold" numberOfLines={1} style={{ maxWidth: 64, textAlign: 'center' }}>
                  {card?.name}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {!allRevealed && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deckScroll}
          style={{ flex: 1 }}
        >
          {Array.from({ length: DECK_VISUAL_SIZE }, (_, i) => i).map((tileIndex) => {
            const tapOrder = tappedTileIndices.indexOf(tileIndex);
            const isTapped = tapOrder !== -1;
            const draw = isTapped ? reading?.draws[tapOrder] : undefined;
            const card = draw ? cardsById[draw.cardId] : undefined;
            return (
              <View key={tileIndex} style={[styles.deckTile, { transform: [{ rotate: isTapped ? '0deg' : tileRotation(tileIndex) }] }]}>
                <FlippableTarotTile
                  card={card}
                  orientation={draw?.orientation}
                  revealed={isTapped}
                  disabled={isTapped || revealedCount >= needed}
                  onPress={() => handleTilePress(tileIndex)}
                  width={88}
                  height={134}
                  reduceMotion={reduceMotion}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {allRevealed && reading && (
        <Button
          label="See my reading"
          icon={Sparkles}
          fullWidth
          style={{ marginTop: spacing.xl }}
          onPress={() => navigation.replace('TarotReport', { readingId: reading.id })}
        />
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tray: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  trayItem: { alignItems: 'center', width: 72 },
  trayCard: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  deckScroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  deckTile: {
    marginHorizontal: 4,
  },
});
