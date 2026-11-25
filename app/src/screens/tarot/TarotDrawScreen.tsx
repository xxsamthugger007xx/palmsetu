import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Sparkles, Info, RotateCcw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { tick, tap, success } from '../../services/haptics';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TarotCardFace } from '../../components/TarotCardFace';
import { FlippableTarotTile } from '../../components/FlippableTarotTile';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { TarotCard, TarotReading } from '../../types/tarot';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
type Stage = 'loading' | 'shuffling' | 'stacked' | 'selecting' | 'error' | 'limited' | 'dailyLimit';

// The whole deck is laid out to choose from: all 78 cards (22 Major + 56 Minor Arcana). Which card each pick turns out to
// be is decided server-side when the reading is created, so this is the real deck the person is choosing from.
const DECK_VISUAL_SIZE = 78;
const TILE_WIDTH = 88;
const TILE_HEIGHT = 134;
// Overlap between adjacent cards in the fan - keeps a 21-card deck a
// reasonable scrollable width while still reading as one continuous fan.
const TILE_OVERLAP = 56;
const FAN_MAX_ROTATION_DEG = 16;
const FAN_MAX_LIFT = 18;
// Pressing a card zooms in on a small cluster around it - itself plus its
// 2 neighbors on each side (5 cards total) - scaling them up and pushing
// them apart so there's real room to land the tap on the exact card
// wanted, rather than a crowded 21-card fan. Falls off with distance so
// only this cluster is affected; everything further away stays normal.
const ZOOM_NEIGHBOR_COUNT = 2;
const ZOOM_SCALE_BY_DISTANCE = [1.45, 1.22, 1.06]; // [active, +-1, +-2]
const ZOOM_SPREAD_PX_BY_DISTANCE = [0, 34, 60]; // horizontal push, same indexing

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function TarotDrawScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TarotDraw'>>();
  const { category, question, spreadType, secondPersonName, existingReadingId } = route.params;
  const isDailyReveal = !!existingReadingId;

  const [stage, setStage] = useState<Stage>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [cardsById, setCardsById] = useState<Record<string, TarotCard>>({});
  const [tappedTileIndices, setTappedTileIndices] = useState<number[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Two-step selection: the first tap on any face-down tile only zooms in
  // on the small cluster around it (itself + its nearest neighbors) - it
  // does NOT select a card yet. A second tap on one of the now-zoomed,
  // easy-to-aim-at cards actually selects that exact one. Tapping outside
  // the current cluster while already zoomed just re-anchors the zoom to
  // the new spot instead of selecting, so browsing around never
  // accidentally commits a card.
  const [zoomedAnchorIndex, setZoomedAnchorIndex] = useState<number | null>(null);
  // Which tile is mid-flash right now (the brief gold pulse right before
  // its flip-reveal plays) - purely cosmetic, cleared once the pulse ends.
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shuffleAnim = useRef(new Animated.Value(0)).current;
  const spreadAnim = useRef(new Animated.Value(0)).current; // 0 = stacked deck, 1 = fanned out

  // Resolved BEFORE starting the reading (not in a separate parallel effect)
  // specifically to avoid a race: isReduceMotionEnabled() and the reading
  // fetch were previously two independent effects, and since the
  // accessibility check resolves fast while the network fetch is slower,
  // reduceMotion could flip to true in time for runShuffle()'s closure to
  // see it - which, combined with the old "skip the whole stacked-deck step"
  // behavior below, meant the entire tap-to-spread experience silently
  // vanished whenever a device/emulator happens to report reduced motion
  // (common default on many emulators). Reduced motion now only removes the
  // animated transitions themselves; every stage (stacked deck -> tap ->
  // fan -> select -> reveal) still happens, just without the motion.
  useEffect(() => {
    (async () => {
      try {
        const [, startRes, catalogueRes] = await Promise.all([
          AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {}),
          // Daily Card reveal: fetch the EXISTING reading (its card was
          // already fixed by GET /tarot/daily, long before this screen
          // opened) rather than drawing a new one - this screen only
          // supplies the shared tap-to-reveal interaction.
          existingReadingId ? tarotApi.getReading(existingReadingId) : tarotApi.startReading(category, spreadType, question ?? undefined, secondPersonName ?? undefined),
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
      } catch (__err) {
        const err = asApiError(__err);
        if (err.status === 403) {
          setErrorMessage(err.message);
          setStage(err.code === 'DAILY_LIMIT_REACHED' ? 'dailyLimit' : 'limited');
        } else {
          setErrorMessage(t('ui.TarotDrawScreen.somethingWentWrongStartingYour'));
          setStage('error');
        }
      }
    })();
  }, []);

  const runShuffle = () => {
    setStage('shuffling');
    if (reduceMotion) {
      setStage('stacked'); // skip only the wiggle animation, not the stacked-deck step itself
      return;
    }
    Animated.sequence([
      Animated.timing(shuffleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(shuffleAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setStage('stacked'));
  };

  // Step 2 of the draw experience: tapping the stacked deck fans it out.
  // Implemented as a crossfade + scale between the stacked view and the fan
  // view (see JSX below) rather than tracking each tile's exact path, which
  // reads as "spreading" smoothly without the complexity of animating 21
  // individual card positions in lockstep.
  const handleSpreadDeck = () => {
    setStage('selecting');
    if (reduceMotion) {
      spreadAnim.setValue(1); // skip only the fade/scale-in animation
      return;
    }
    Animated.timing(spreadAnim, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  };

  const needed = reading?.draws.length ?? 0;
  const revealedCount = tappedTileIndices.length;
  const allRevealed = reading !== null && revealedCount >= needed;

  // Cards remaining to choose - shown explicitly per the "how many cards
  // remain" requirement, distinct from the tray's "N of M selected" count.
  const remaining = Math.max(0, needed - revealedCount);
  // Everything chosen: a little celebration buzz.
  const celebrated = useRef(false);
  useEffect(() => { if (allRevealed && !celebrated.current) { celebrated.current = true; success(); } }, [allRevealed]);

  // Pure display substitution only - never changes stored data. The
  // position is always canonically "Them" server-side; this just shows the
  // optional name the user entered instead, everywhere that position name
  // would otherwise be rendered.
  const displayPositionName = (name: string) => (name === 'Them' && secondPersonName ? secondPersonName : name);

  const triggerSpreadLayoutAnimation = () => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleXY));
  };

  const withinZoomedCluster = (tileIndex: number, anchor: number) => Math.abs(tileIndex - anchor) <= ZOOM_NEIGHBOR_COUNT;

  const handleTilePress = (tileIndex: number) => {
    if (!reading || tappedTileIndices.includes(tileIndex) || revealedCount >= needed) return;

    // Step 1: nothing zoomed yet, or this tap landed outside the currently
    // zoomed cluster - just zoom in here (or re-anchor), never select.
    if (zoomedAnchorIndex === null || !withinZoomedCluster(tileIndex, zoomedAnchorIndex)) {
      triggerSpreadLayoutAnimation();
      setZoomedAnchorIndex(tileIndex);
      tick();
      return;
    }

    // Step 2: this tap landed on a card within the already-zoomed cluster
    // (including the anchor card itself) - select it for real, with a
    // brief flash right before the flip-reveal plays.
    triggerSpreadLayoutAnimation();
    setZoomedAnchorIndex(null);
    setFlashIndex(tileIndex);
    tap();
    if (reduceMotion) {
      setFlashIndex(null);
      setTappedTileIndices((prev) => [...prev, tileIndex]);
      return;
    }
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setFlashIndex(null));
    setTappedTileIndices((prev) => [...prev, tileIndex]);
  };

  // Daily Card reveal still marks today's reveal as done (same AsyncStorage
  // flag TarotLandingScreen itself checks on return, so Home shows it
  // already revealed rather than asking again) - but now goes on to the
  // full TarotReport, same as any other reading, instead of stopping short
  // at a "Done" button that just went back to Home.
  const markDailyRevealedIfNeeded = () => {
    if (isDailyReveal && reading) {
      AsyncStorage.setItem(`tarot_daily_revealed:${reading.id}`, 'true').catch(() => {});
    }
  };

  // Explicit restart, only ever available before the reading is submitted
  // (the "See my reading" button only appears once allRevealed, and this
  // control disappears at that point) - clears which face-down tiles have
  // been tapped, but never touches reading.draws itself, since those were
  // already fixed server-side at /readings creation. Restarting the
  // selection order never re-draws or re-shuffles the underlying cards.
  const handleRestart = () => {
    setTappedTileIndices([]);
    setZoomedAnchorIndex(null);
  };

  // Fan geometry: each tile's rotation/lift is a function of its distance
  // from the center of the deck, so the whole row reads as one continuous
  // arc rather than independently-wiggling tiles.
  const fanTransform = useMemo(() => {
    const mid = (DECK_VISUAL_SIZE - 1) / 2;
    return (i: number) => {
      const t = (i - mid) / mid; // -1..1
      return {
        rotateDeg: t * FAN_MAX_ROTATION_DEG,
        translateY: Math.abs(t) * FAN_MAX_LIFT,
      };
    };
  }, []);

  // After the first tap anchors zoomedAnchorIndex, this zooms in on the
  // small cluster around it - itself plus up to ZOOM_NEIGHBOR_COUNT cards
  // on each side - scaling them up and pushing them apart, with everything
  // outside the cluster left at normal size. Combined with LayoutAnimation
  // on each tap, this animates smoothly without needing a dedicated
  // Animated.Value per tile.
  const zoomCluster = (tileIndex: number): { scale: number; offsetX: number; zIndex: number } => {
    if (zoomedAnchorIndex === null) return { scale: 1, offsetX: 0, zIndex: 0 };
    const distance = Math.abs(tileIndex - zoomedAnchorIndex);
    if (distance > ZOOM_NEIGHBOR_COUNT) return { scale: 1, offsetX: 0, zIndex: 0 };
    const scale = ZOOM_SCALE_BY_DISTANCE[distance];
    const direction = tileIndex > zoomedAnchorIndex ? 1 : tileIndex < zoomedAnchorIndex ? -1 : 0;
    const offsetX = direction * ZOOM_SPREAD_PX_BY_DISTANCE[distance];
    // Closer to the anchor card = higher zIndex, so the whole cluster
    // overlaps correctly (the anchor fully on top, its immediate
    // neighbors next, etc.) instead of z-fighting with scroll order.
    return { scale, offsetX, zIndex: ZOOM_NEIGHBOR_COUNT + 1 - distance };
  };

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

  if (stage === 'stacked') {
    return (
      <PageContainer scroll={false}>
        <View style={styles.center}>
          <Pressable onPress={handleSpreadDeck} accessibilityRole="button" accessibilityLabel={t('ui.TarotDrawScreen.tapTheDeckToSpread')}>
            <View style={styles.deckStack}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.stackCard, { top: -i * 3, left: i * 2 }]}>
                  <TarotCardFace faceDown width={150} height={226} />
                </View>
              ))}
            </View>
          </Pressable>
          <Text variant="bodySm" style={{ marginTop: spacing.xl, textAlign: 'center', color: tarotColor.gold }}>
            {t('ui.TarotDrawScreen.takeAMomentAndChoose')}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
            {t('ui.TarotDrawScreen.tapTheDeckToSpread')}
          </Text>
        </View>
      </PageContainer>
    );
  }

  if (stage === 'limited' || stage === 'error' || stage === 'dailyLimit') {
    return (
      <PageContainer>
        <EmptyState
          icon={Info}
          title={stage === 'limited' ? 'Premium reading' : stage === 'dailyLimit' ? 'Daily limit reached' : 'Something went wrong'}
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
        {allRevealed ? 'Your cards are ready' : 'Take a moment and choose your cards'}
      </Text>
      <Text variant="caption" style={{ marginTop: 4, textAlign: 'center', color: tarotColor.gold }}>
        {allRevealed
          ? "Let's explore the message of your spread."
          : zoomedAnchorIndex !== null
            ? 'Tap one of these cards to choose it'
            : `${remaining} card${remaining === 1 ? '' : 's'} remaining - ${revealedCount} of ${needed} selected`}
      </Text>

      {/* Selection tray: fills in as each position is chosen */}
      <View style={styles.tray}>
        {reading?.draws.map((draw, i) => {
          const isRevealed = i < revealedCount;
          const card = cardsById[draw.cardId];
          return (
            <View key={draw.positionIndex} style={styles.trayItem}>
              <Text variant="caption" tone="muted" numberOfLines={1}>{displayPositionName(draw.positionName)}</Text>
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
        <Animated.View
          style={{
            flex: 1,
            opacity: reduceMotion ? 1 : spreadAnim,
            transform: reduceMotion ? [] : [{ scale: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          }}
        >
        <LinearGradient
          colors={[tarotColor.indigo, tarotColor.midnight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fanStage}
        >
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
              const { rotateDeg, translateY } = fanTransform(tileIndex);
              const isAnchor = tileIndex === zoomedAnchorIndex;
              const { scale, offsetX, zIndex } = zoomCluster(tileIndex);
              return (
                <View
                  key={tileIndex}
                  style={[
                    styles.deckTile,
                    isAnchor && styles.anchorGlow,
                    {
                      marginLeft: tileIndex === 0 ? 0 : -TILE_OVERLAP,
                      zIndex,
                      transform: isTapped
                        ? [{ rotate: '0deg' }, { translateY: -8 }]
                        : [
                            { translateX: offsetX },
                            { rotate: `${isAnchor ? 0 : rotateDeg}deg` },
                            { translateY: isAnchor ? translateY - 26 : translateY - (scale - 1) * 40 },
                            { scale },
                          ],
                    },
                  ]}
                >
                  <FlippableTarotTile
                    card={card}
                    orientation={draw?.orientation}
                    revealed={isTapped}
                    disabled={isTapped || revealedCount >= needed}
                    onPress={() => handleTilePress(tileIndex)}
                    width={TILE_WIDTH}
                    height={TILE_HEIGHT}
                    reduceMotion={reduceMotion}
                  />
                  {flashIndex === tileIndex && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.flashOverlay,
                        {
                          width: TILE_WIDTH,
                          height: TILE_HEIGHT,
                          opacity: flashAnim,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>
          <Text variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: spacing.xs }}>{t('tarot.deckBrowse', { count: DECK_VISUAL_SIZE })}</Text>
        </LinearGradient>
        </Animated.View>
      )}

      {allRevealed && reading && (
        <Button
          label={t('ui.TarotDrawScreen.seeMyReading')}
          icon={Sparkles}
          fullWidth
          style={{ marginTop: spacing.xl }}
          onPress={() => {
            markDailyRevealedIfNeeded();
            navigation.replace('TarotReport', { readingId: reading.id });
          }}
        />
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deckStack: {
    width: 150,
    height: 226,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackCard: {
    position: 'absolute',
  },
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
  fanStage: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
    paddingVertical: spacing.lg,
  },
  deckScroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  deckTile: {},
  // The card under your finger glows gold so you can see exactly which one you are about to pick.
  anchorGlow: { shadowColor: tarotColor.gold, shadowOpacity: 0.85, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: radius.lg,
    backgroundColor: tarotColor.gold,
  },
});
