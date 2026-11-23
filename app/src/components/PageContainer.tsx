import { devWarn } from '../utils/log';
import React from 'react';
import { Animated, Platform, RefreshControl, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, spacing } from '../theme/tokens';
import { PullRefreshIndicator, RefreshPhase } from './PullRefreshIndicator';
import { pullOffset } from '../services/pullOffsetTracker';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Pull-to-refresh: pass the same async function a screen already uses to
   * (re)load its data (e.g. the body of its useFocusEffect callback) and
   * pulling down re-runs it. Omit on screens with nothing meaningful to
   * refresh (e.g. a static form). This component manages the spinner state
   * internally so callers don't need their own refreshing boolean.
   *
   * IMPORTANT: this must only ever be a read/re-fetch operation (GET-style
   * calls that re-populate existing state) - never anything that generates
   * new content (an AI reading, a palm scan) or mutates server state.
   * Every onRefresh wired up in this app's screens is already just a
   * refetch of that screen's own existing load() function, which is what
   * guarantees a pull-to-refresh can never regenerate a saved reading,
   * create a duplicate palm profile, or touch auth/guest session state -
   * none of those load() functions do any of that to begin with. */
  onRefresh?: () => void | Promise<void>;
};

// Approximate visual threshold for the custom indicator's pull animation -
// this does not need to exactly match the OS's own internal release
// threshold (that's not something RefreshControl exposes), it only needs
// to feel proportional as the user pulls, which a ~72px pull comfortably
// covers on both platforms without requiring an excessive drag.
const PULL_VISUAL_THRESHOLD = 72;
// How long the success checkmark stays visible before the indicator
// disappears entirely - long enough to register as "done", short enough to
// never feel like it's blocking the now-fresh content underneath.
const COMPLETED_HOLD_MS = 550;

/** Standard screen wrapper: solid background, safe-area-aware top inset, consistent
 * side gutters, safe scrolling. Every screen should render inside this instead of
 * padding itself, so top content never draws under the status bar / notch. */
export function PageContainer({ children, scroll = true, style, onRefresh }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = React.useState<RefreshPhase>('idle');
  const refreshingRef = React.useRef(false); // guards against overlapping/duplicate refresh calls, independent of React's async state batching
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const completedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const padding = {
    paddingHorizontal: spacing.lg,
    paddingTop: insets.top + spacing.sm,
    paddingBottom: insets.bottom + spacing.xxl,
  };

  React.useEffect(() => () => {
    if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
  }, []);

  const handleRefresh = React.useCallback(async () => {
    if (!onRefresh || refreshingRef.current) return; // never run two refreshes at once
    refreshingRef.current = true;
    setPhase('refreshing');
    let failed = false;
    try {
      await onRefresh();
    } catch (err) {
      // Failed API request: stop the loader and leave whatever content was
      // already on screen exactly as it was - no blank state, no partial
      // clear. The individual load() functions this is wired to already
      // catch their own errors internally (see e.g. HomeScreen's
      // loadHomeData), so reaching this catch means something unexpected
      // happened; still fail gracefully rather than leaving the indicator
      // stuck spinning forever.
      failed = true;
      devWarn('[PageContainer] pull-to-refresh failed:', err);
    } finally {
      if (failed) {
        setPhase('idle');
        refreshingRef.current = false;
      } else {
        setPhase('completed');
        completedTimerRef.current = setTimeout(() => {
          setPhase('idle');
          refreshingRef.current = false;
        }, COMPLETED_HOLD_MS);
      }
    }
  }, [onRefresh]);

  const handleScroll = React.useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      // Shared with globally-mounted overlays (UpgradeButton) so they can
      // move down with the content while the user is actively pulling,
      // rather than staying frozen in place. Set unconditionally (even
      // while refreshing) so the button settles back to 0 as the list
      // snaps back to its resting position.
      pullOffset.setValue(y);
      if (refreshingRef.current) return; // don't let scroll jitter during a refresh reopen the pulling state
      setPhase((prev) => {
        if (prev === 'refreshing' || prev === 'completed') return prev;
        return y < -4 ? 'pulling' : 'idle';
      });
    },
    []
  );

  if (!scroll) {
    return <View style={[styles.root, padding, style]}>{children}</View>;
  }

  const pullProgress = scrollY.interpolate({
    inputRange: [-PULL_VISUAL_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Android's native RefreshControl circle cannot be hidden (iOS supports
  // tintColor="transparent", Android has no equivalent) - rather than fight
  // the platform with a fragile negative-offset hack, the native circle is
  // kept but brand-tinted on Android, and the custom indicator below is
  // only shown for the pulling/completed states there, so the two never
  // render on top of each other during the actual refresh itself.
  const indicatorPhase: RefreshPhase = Platform.OS === 'android' && phase === 'refreshing' ? 'idle' : phase;

  return (
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={[padding, style]}
      showsVerticalScrollIndicator={false}
      bounces
      alwaysBounceVertical
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: handleScroll,
      })}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={phase === 'refreshing'}
            onRefresh={handleRefresh}
            tintColor={Platform.OS === 'ios' ? 'transparent' : color.accent}
            colors={[color.accent]}
            progressBackgroundColor={color.surfaceElevated}
            progressViewOffset={Platform.OS === 'android' ? insets.top + spacing.sm : 0}
          />
        ) : undefined
      }
    >
      {onRefresh && <PullRefreshIndicator progress={pullProgress} phase={indicatorPhase} />}
      {children}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
});
