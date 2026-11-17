import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { sessionApi } from './sessionApi';

/**
 * Real app-lifecycle session tracking, wired into App.tsx (AppState) and
 * RootNavigator.tsx (screen changes). This is the client half of Phase 2's
 * Session Intelligence - the server half lives in
 * server/src/events/sessionTracker.ts, which that file's doc comment
 * explains the honest limits of (RN cannot observe a hard kill/force-quit,
 * only a clean background).
 *
 * Device model (e.g. "Pixel 7") is deliberately NOT collected - that would
 * need the expo-device native module, which isn't installed in this app,
 * and adding a new native dependency is out of scope for this pass. `os`
 * below is Platform.OS ("ios"/"android"), which is always real and free.
 */

// How long the app can sit backgrounded before a resume is treated as a
// brand-new session rather than a continuation of the old one - the
// standard "was this really a new visit" grace window used by most mobile
// analytics SDKs (Firebase/Amplitude both default in the same 30s range).
const BACKGROUND_GRACE_MS = 30_000;

let sessionId: string | null = null;
let currentScreen: string | null = null;
let backgroundedAt: number | null = null;
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

function deviceInfo() {
  return {
    device: null, // see module doc comment - not collected without expo-device
    os: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? null,
  };
}

async function beginSession(entryScreen: string | null) {
  try {
    const { sessionId: id } = await sessionApi.start({ ...deviceInfo(), entryScreen });
    sessionId = id;
  } catch {
    // No session this app-open if the first call fails (e.g. offline at
    // launch) - every tracking call below already no-ops without an id,
    // so this degrades to "no session tracking," never a crash.
    sessionId = null;
  }
}

/** Call once, as early as possible after the navigation container is ready. */
export function initSessionTracking(entryScreen: string | null) {
  currentScreen = entryScreen;
  void beginSession(entryScreen);
}

/** Call from RootNavigator's onStateChange/onReady with the new current route name and its mapped feature (if any). */
export function trackScreenChange(screenName: string | undefined, feature: string | undefined) {
  if (!screenName || screenName === currentScreen) return;
  currentScreen = screenName;
  if (!sessionId) return;
  void sessionApi.event(sessionId, { type: 'screen_view', screen: screenName });
  if (feature) void sessionApi.event(sessionId, { type: 'feature_used', feature });
}

export function trackAction(action: string) {
  if (!sessionId) return;
  void sessionApi.event(sessionId, { type: 'action', action });
}

/** `error` should be a short code/message only - never a stack trace or anything containing user content. */
export function trackError(error: string) {
  if (!sessionId) return;
  void sessionApi.event(sessionId, { type: 'error', error: error.slice(0, 200) });
}

/**
 * Wire this to AppState's 'change' event from App.tsx. Handles the
 * background-then-quickly-resume case (same session continues, no new
 * session/no end call - matches "handle reconnection properly") versus a
 * background that lasts past the grace window (real end, then a fresh
 * session starts on resume).
 *
 * Correctness note: a setTimeout is NOT trusted as the source of truth for
 * "how long were we backgrounded" - iOS/Android both throttle or fully
 * suspend JS timers once backgrounded, so the timer may simply never fire
 * while the app is away. The real check happens here, on resume, using the
 * wall-clock `backgroundedAt` timestamp recorded before suspension. The
 * timer is kept only as a best-effort proactive close for the case where
 * the JS thread does keep running in the background.
 */
export function handleAppStateChange(nextState: 'active' | 'background' | 'inactive') {
  if (nextState === 'active') {
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
    if (backgroundedAt) {
      const elapsed = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (elapsed >= BACKGROUND_GRACE_MS) {
        // Away long enough that this is a new visit, not a reconnection.
        // End the old session first (no-ops server-side if it was already
        // closed by the proactive timer above) and start a fresh one.
        if (sessionId) {
          const staleId = sessionId;
          sessionId = null;
          void sessionApi.end(staleId, 'background');
        }
        void beginSession(currentScreen);
      }
      // else: within the grace window - same session continues, nothing to send.
    } else if (!sessionId) {
      // No recorded background (e.g. first launch edge case) and somehow
      // no active session - make sure one exists.
      void beginSession(currentScreen);
    }
    return;
  }

  // 'background' or 'inactive': record the timestamp exactly once.
  if (backgroundedAt) return; // already backgrounded; inactive->background can double-fire
  backgroundedAt = Date.now();
  backgroundTimer = setTimeout(() => {
    if (sessionId) {
      void sessionApi.end(sessionId, 'background');
      sessionId = null;
    }
    backgroundTimer = null;
  }, BACKGROUND_GRACE_MS);
}
