import React from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crown } from 'lucide-react-native';
import { color, radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { pullOffset } from '../services/pullOffsetTracker';
import { useTranslation } from 'react-i18next';

interface Props {
  onPress: () => void;
}

// How far down the button travels at a full pull - matches
// PageContainer.tsx's own PULL_VISUAL_THRESHOLD exactly, so the button
// visibly tracks the same pull distance as the refresh indicator and the
// content itself, instead of lagging behind at a damped fraction of it.
const MAX_PULL_TRAVEL = 72;

/**
 * Fixed top-right "Upgrade" entry point, visible across every main tab
 * screen - a single global element (mounted once by RootNavigator, same
 * pattern as FloatingAIButton) rather than something each screen has to
 * render itself, so it stays consistent regardless of which screen's own
 * header layout is in play.
 *
 * Moves down with the content while the user pulls down to refresh (see
 * services/pullOffsetTracker.ts) - without this it looked frozen/detached
 * while everything else on screen slid down underneath it. It stays fixed
 * during ordinary scrolling (scrolling up never produces a positive
 * pullOffset in the direction this responds to), only reacting to the
 * pull-to-refresh gesture itself.
 */
export function UpgradeButton({ onPress }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = pullOffset.interpolate({
    inputRange: [-MAX_PULL_TRAVEL, 0],
    outputRange: [MAX_PULL_TRAVEL, 0],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[styles.base, { top: insets.top + spacing.sm, transform: [{ translateY }] }]}>
      <Pressable accessibilityRole="button"
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [styles.inner, pressed && styles.pressed]}
      >
        <Crown size={13} color={color.accent} strokeWidth={2} />
        <Text variant="label" tone="accent" style={styles.label}>{t('ui.UpgradeButton.upgrade')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
    // Opaque backing so scrolling content never shows through the translucent pill.
    backgroundColor: color.bg,
    borderRadius: radius.pill ?? 999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill ?? 999,
    backgroundColor: color.accentMuted,
    borderWidth: 1,
    borderColor: color.accentBorder,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    marginLeft: 4,
    letterSpacing: 0.5,
  },
});
