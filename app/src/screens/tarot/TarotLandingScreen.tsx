import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { History, Info, Layers, Heart, Briefcase, Compass as CompassIcon, MessageCircleQuestion, Lock, ChevronRight, Sparkles, Wand2 } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TarotCardFace } from '../../components/TarotCardFace';
import { TarotInfoModal } from '../../components/TarotInfoModal';
import { FadeInUp } from '../../components/FadeInUp';
import { color, radius, spacing } from '../../theme/tokens';
import { tarotColor, heroGradient } from '../../theme/tarotTheme';
import { RootStackParamList } from '../../navigation/types';
import { tarotApi } from '../../services/tarotApi';
import { DailyTarot, SpreadType, TarotCard as TarotCardType, TarotReading, formatSpreadLabel } from '../../types/tarot';

type LoadState = 'loading' | 'ready' | 'error';

type TileTarget = { category: 'love' | 'career' | 'general' | 'question'; spreadIds: SpreadType[]; questionMode: 'none' | 'optional' | 'required' };

/**
 * Each tile opens ITS OWN spread (not a generic category picker). "One-card reading" is the free Daily Card - the same
 * card as "See my card" above - so it has no target and opens the daily reveal instead. Every other tile is Premium.
 */
const categoryTiles: { id: string; i18nKey: string; icon: typeof Layers; premium: boolean; target?: TileTarget }[] = [
  { id: 'one-card', i18nKey: 'oneCard', icon: Layers, premium: false },
  { id: 'three-card', i18nKey: 'threeCard', icon: Layers, premium: true, target: { category: 'general', spreadIds: ['three-card-ppf', 'three-card-scg', 'three-card-mbs'], questionMode: 'optional' } },
  { id: 'love', i18nKey: 'love', icon: Heart, premium: true, target: { category: 'love', spreadIds: ['love-relationship'], questionMode: 'optional' } },
  { id: 'career', i18nKey: 'career', icon: Briefcase, premium: true, target: { category: 'career', spreadIds: ['career-finance'], questionMode: 'optional' } },
  { id: 'general', i18nKey: 'general', icon: CompassIcon, premium: true, target: { category: 'general', spreadIds: ['one-card', 'three-card-scg'], questionMode: 'optional' } },
  { id: 'celtic-cross', i18nKey: 'celticCross', icon: MessageCircleQuestion, premium: true, target: { category: 'general', spreadIds: ['celtic-cross'], questionMode: 'optional' } },
  { id: 'yes-no', i18nKey: 'yesNo', icon: CompassIcon, premium: true, target: { category: 'question', spreadIds: ['yes-no'], questionMode: 'required' } },
  { id: 'relationship-compatibility', i18nKey: 'compatibility', icon: Heart, premium: true, target: { category: 'love', spreadIds: ['relationship-compatibility'], questionMode: 'optional' } },
  { id: 'five-card', i18nKey: 'fiveCard', icon: Wand2, premium: true, target: { category: 'general', spreadIds: ['five-card'], questionMode: 'optional' } },
];

export function TarotLandingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<LoadState>('loading');
  const [daily, setDaily] = useState<{ daily: DailyTarot; reading: TarotReading } | null>(null);
  const [cardsById, setCardsById] = useState<Record<string, TarotCardType>>({});
  const [revealed, setRevealed] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [history, setHistory] = useState<TarotReading[]>([]);

  // The "tap to reveal" ceremony should only ever be asked once per day,
  // not every time this screen regains focus - the daily card itself is
  // already fully determined and persisted server-side the moment
  // getDailyCard() first returns it (see routes/tarot.ts's /daily), so
  // re-asking for a ceremonial tap on every revisit was a pure local-state
  // bug (revealed defaulted to false on every mount), not a backend one.
  // Keyed by the day's real readingId (stable all day, changes the next
  // day) so this naturally resets itself with no date-math needed here.
  const revealedStorageKey = (readingId: string) => `tarot_daily_revealed:${readingId}`;

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

      try {
        const alreadyRevealed = await AsyncStorage.getItem(revealedStorageKey(dailyRes.daily.readingId));
        setRevealed(alreadyRevealed === 'true');
      } catch {
        // If local storage is unavailable for any reason, default to NOT
        // revealed rather than crash - worst case the user taps once more,
        // never worse than before this fix.
        setRevealed(false);
      }

      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  // Reveal is no longer a plain in-place flip - it's the same stacked-deck
  // -> tap -> fan -> select -> flip experience as any other one-card draw
  // (TarotDrawScreen), since the Daily Card and a free one-card reading are
  // mechanically identical (one card, one position) and deserve the same
  // premium interaction rather than a separate, simpler one. The screen
  // fetches the EXISTING daily reading by id instead of drawing a new card.
  const handleReveal = () => {
    if (!daily) return;
    navigation.navigate('TarotDraw', {
      category: daily.reading.readingType,
      spreadType: daily.reading.spreadType,
      question: daily.reading.question,
      existingReadingId: daily.daily.readingId,
    });
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (state === 'loading') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm }}>{t('tarot.title')}</Text>
        <Text variant="bodySm" tone="muted" style={{ marginTop: spacing.lg }}>{t('tarot.loading')}</Text>
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>{t('tarot.title')}</Text>
        <EmptyState
          icon={Info}
          title={t('tarot.errorTitle')}
          description={t('tarot.errorDesc')}
          actionLabel={t('common.retry')}
          onAction={load}
        />
      </PageContainer>
    );
  }

  const dailyCard = daily ? cardsById[daily.daily.cardId] : undefined;

  return (
    <PageContainer onRefresh={load}>
      <FadeInUp>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.header}>
          <View>
            <Text variant="display" weight="semibold" tone="primary">{t('tarot.title')}</Text>
            <Text variant="bodySm" style={[styles.heroSubtitle, { marginTop: 2 }]}>{t('tarot.subtitle')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <IconButton icon={Info} onPress={() => setInfoVisible(true)} />
            <IconButton icon={History} onPress={() => navigation.navigate('TarotHistory')} />
          </View>
        </View>

        <View style={styles.dailyCardPanel}>
          <View style={styles.dailyLabelRow}>
            <Sparkles size={12} color={tarotColor.gold} strokeWidth={2} />
            <Text variant="label" style={{ color: tarotColor.gold, marginLeft: spacing.xs }}>{t('tarot.dailyCardLabel')}</Text>
          </View>
          <View style={{ marginTop: spacing.md, marginBottom: spacing.md, alignItems: 'center' }}>
            <TarotCardFace card={dailyCard} orientation={daily?.daily.orientation} faceDown={!revealed} width={150} height={224} />
          </View>

          {!revealed ? (
            <Button label={t('tarot.revealMyCard')} onPress={handleReveal} />
          ) : dailyCard ? (
            <View style={{ alignItems: 'center', width: '100%' }}>
              <Text variant="subtitle" weight="semibold" tone="primary">{dailyCard.name}</Text>
              <Text variant="caption" style={[styles.heroSubtitle, { marginTop: 2, marginBottom: spacing.sm }]}>
                {daily?.daily.orientation === 'reversed' ? t('tarot.reversed') : t('tarot.upright')}
              </Text>
              <Text variant="bodySm" style={[styles.heroSubtitle, { textAlign: 'center' }]}>
                {daily?.daily.orientation === 'reversed' ? dailyCard.reversedGeneral : dailyCard.general}
              </Text>
              <Text variant="bodySm" style={{ color: tarotColor.lavender, marginTop: spacing.sm, textAlign: 'center' }}>
                {dailyCard.reflectionPrompt}
              </Text>
              <Button
                label={t('tarot.openFullReading')}
                variant="secondary"
                size="sm"
                style={{ marginTop: spacing.md }}
                onPress={() => daily && navigation.navigate('TarotReport', { readingId: daily.daily.readingId })}
              />
            </View>
          ) : null}
        </View>
      </LinearGradient>
      </FadeInUp>

      <FadeInUp delay={100}>
      <Card
        elevated
        style={styles.personalReadingCard}
        onPress={() => navigation.navigate('TarotCategory', undefined)}
      >
        <View style={styles.personalReadingIcon}>
          <Wand2 size={20} color={tarotColor.gold} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="subtitle" weight="semibold">{t('tarot.personalReadingTitle')}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('tarot.personalReadingSubtitle')}</Text>
        </View>
        <ChevronRight size={18} color={color.textMuted} />
      </Card>
      </FadeInUp>

      <FadeInUp delay={180}>
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={t('tarot.categoriesTitle')} />
        <View style={styles.grid}>
          {categoryTiles.map((tile) => (
            <Card
              key={tile.id}
              style={styles.tile}
              onPress={() => {
                if (!tile.target) {
                  // One-card = the daily card: reveal it, or open it if it was already revealed today.
                  if (!daily) return;
                  if (revealed) navigation.navigate('TarotReport', { readingId: daily.daily.readingId });
                  else handleReveal();
                  return;
                }
                navigation.navigate('TarotSpread', { category: tile.target.category, question: null, spreadIds: tile.target.spreadIds, questionMode: tile.target.questionMode });
              }}
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
              <Text variant="bodySm" weight="semibold" style={{ marginTop: spacing.sm }}>{t(`tarot.categories.${tile.i18nKey}.title`)}</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {t(`tarot.categories.${tile.i18nKey}.description`)}
              </Text>
            </Card>
          ))}
        </View>
      </View>
      </FadeInUp>

      <FadeInUp delay={260}>
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title={t('tarot.recentReadingsTitle')} action={history.length > 0 ? t('common.viewAll') : undefined} onActionPress={() => navigation.navigate('TarotHistory')} />
        {history.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t('tarot.noReadingsTitle')}
            description={t('tarot.noReadingsDesc')}
            actionLabel={t('tarot.startAReading')}
            onAction={() => navigation.navigate('TarotCategory', undefined)}
          />
        ) : (
          history.map((r) => (
            <Card key={r.id} style={styles.historyRow} onPress={() => navigation.navigate('TarotReport', { readingId: r.id })}>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="semibold">{formatSpreadLabel(r.spreadType)}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {new Date(r.createdAt).toLocaleDateString()} · {t('tarot.cardCount', { count: r.draws.length })}
                </Text>
              </View>
              <ChevronRight size={16} color={color.textMuted} />
            </Card>
          ))
        )}
      </View>
      </FadeInUp>

      <TarotInfoModal visible={infoVisible} onClose={() => setInfoVisible(false)} />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: tarotColor.goldMuted,
  },
  heroSubtitle: {
    color: 'rgba(233, 233, 237, 0.75)',
  },
  dailyCardPanel: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  dailyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  personalReadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    borderColor: tarotColor.goldMuted,
  },
  personalReadingIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: tarotColor.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
