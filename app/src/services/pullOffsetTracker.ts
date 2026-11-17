import { Animated } from 'react-native';

/**
 * Shared scroll-offset signal for the currently visible screen's
 * PageContainer, written on every scroll/pull event (see
 * PageContainer.tsx's handleScroll) and read by globally-mounted overlays
 * (UpgradeButton, FloatingAIButton) that want to visually move with the
 * content while the user pulls down to refresh, instead of staying frozen
 * in place while everything beneath them slides away.
 *
 * Only one screen is ever actually being touched/scrolled at a time (tab
 * screens that aren't focused don't receive scroll gestures), so a single
 * shared value is safe even though multiple PageContainer instances may be
 * mounted at once across tabs.
 */
export const pullOffset = new Animated.Value(0);
