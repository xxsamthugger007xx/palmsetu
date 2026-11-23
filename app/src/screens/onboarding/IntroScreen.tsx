import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, spacing } from '../../theme/tokens';
import { useOnboardingIntro } from '../../context/OnboardingIntroContext';
import { PalmHeroVisual } from './intro/PalmHeroVisual';
import { TarotHeroVisual } from './intro/TarotHeroVisual';
import { ChatHeroVisual } from './intro/ChatHeroVisual';

const PAGE_COUNT = 3;

export function IntroScreen() {
  const { t } = useTranslation();
  const { completeIntro } = useOnboardingIntro();

  const [page, setPage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [navigating, setNavigating] = useState(false);
  // The carousel breaks out of PageContainer's side padding (negative margin below) so
  // it spans the full window; each page is exactly one window wide and self-centers.
  const { width: pageWidth } = useWindowDimensions();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page > 0) {
        goToPage(page - 1);
        return true;
      }
      return false; // first page: let the system handle it (no screen before this one)
    });
    return () => sub.remove();
  }, [page]);

  const goToPage = (index: number) => {
    const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, index));
    setPage(clamped);
    scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: !reduceMotion });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (pageWidth || 1));
    setPage(index);
  };

  const finish = async () => {
    if (navigating) return; // guard against rapid repeated taps
    setNavigating(true);
    // completeIntro() flips hasSeenIntro; RootNavigator swaps the screen from state.
    await completeIntro();
  };

  const handleSkip = () => finish();
  const handlePrimary = () => {
    if (page < PAGE_COUNT - 1) {
      goToPage(page + 1);
    } else {
      finish();
    }
  };

  const pages = [
    { Hero: PalmHeroVisual, badge: t('intro.screen1Badge'), headline: t('intro.screen1Headline'), body: t('intro.screen1Body'), alt: t('intro.screen1ImageAlt') },
    { Hero: TarotHeroVisual, badge: t('intro.screen2Badge'), headline: t('intro.screen2Headline'), body: t('intro.screen2Body'), alt: t('intro.screen2ImageAlt') },
    { Hero: ChatHeroVisual, badge: t('intro.screen3Badge'), headline: t('intro.screen3Headline'), body: t('intro.screen3Body'), alt: t('intro.screen3ImageAlt') },
  ];

  const isLastPage = page === PAGE_COUNT - 1;

  return (
    <PageContainer scroll={false}>
      <View style={styles.topRow}>
        {page > 0 ? (
          <IconButton icon={ChevronLeft} onPress={() => goToPage(page - 1)} />
        ) : (
          <View style={{ width: 36 }} />
        )}
        {!isLastPage && (
          <Text
            variant="bodySm"
            tone="muted"
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
          >
            {t('common.skip')}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        style={{ marginHorizontal: -spacing.lg, flex: 1 }}
        contentContainerStyle={{ alignItems: 'stretch' }}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {pages.map((p, i) => (
          <View key={i} style={{ width: pageWidth }}>
            <View style={styles.pageContent}>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={p.alt}
                style={styles.heroWrap}
              >
                <p.Hero size={Math.min(pageWidth * 0.62, 260)} />
              </View>

              <Text variant="label" tone="accent" style={{ marginTop: spacing.xl, textAlign: 'center', width: '100%' }}>
                {p.badge}
              </Text>
              <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, textAlign: 'center', width: '100%' }}>
                {p.headline}
              </Text>
              <Text
                variant="bodySm"
                tone="secondary"
                style={{ marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.md, width: '100%' }}
                numberOfLines={3}
              >
                {p.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <Button
        label={isLastPage ? t('common.getStarted') : t('common.continue')}
        fullWidth
        loading={navigating}
        style={{ marginTop: spacing.md }}
        onPress={handlePrimary}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.border,
  },
  dotActive: {
    backgroundColor: color.accent,
    width: 18,
  },
});
