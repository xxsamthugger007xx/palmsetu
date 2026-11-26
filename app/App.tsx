import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { handleAppStateChange } from './src/services/sessionTracker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OnboardingIntroProvider } from './src/context/OnboardingIntroContext';
import { WelcomeAuthProvider } from './src/context/WelcomeAuthContext';
import { FeatureFlagsProvider } from './src/context/FeatureFlagsContext';
import { AdminRoleProvider } from './src/context/AdminRoleContext';
import { AstrologyOnboardingStatusProvider } from './src/context/AstrologyOnboardingStatus';
import { useNocturneFonts } from './src/theme/useNocturneFonts';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { initCrashReporting, wrapWithCrashReporting } from './src/services/crashReporting';

initCrashReporting();

SplashScreen.preventAutoHideAsync().catch(() => {});

const MIN_SPLASH_MS = 1400;

function App() {
  // Fonts load in the background; the system font fallback renders in the
  // meantime so startup is never blocked on a network font fetch.
  const fontsReady = useNocturneFonts();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const appReady = fontsReady && minTimeElapsed;

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // App-lifecycle session tracking (Phase 2's Session Intelligence - see
  // src/services/sessionTracker.ts for what this can and can't observe).
  // The session itself is started separately, from RootNavigator once the
  // first real route name is known (see its onReady), so the very first
  // session gets a real entryScreen instead of null.
  const appState = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) ?? 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
      if (nextState === 'active' || nextState === 'background' || nextState === 'inactive') {
        handleAppStateChange(nextState);
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AnimatedSplash ready={appReady} onFinished={() => {}}>
          <FeatureFlagsProvider>
            <AuthProvider>
              <UserProfileProvider>
                <LanguageProvider>
                  <OnboardingIntroProvider>
                    <WelcomeAuthProvider>
                      <AdminRoleProvider>
                        <AstrologyOnboardingStatusProvider>
                          <RootNavigator />
                        </AstrologyOnboardingStatusProvider>
                      </AdminRoleProvider>
                    </WelcomeAuthProvider>
                  </OnboardingIntroProvider>
                </LanguageProvider>
              </UserProfileProvider>
            </AuthProvider>
          </FeatureFlagsProvider>
        </AnimatedSplash>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapWithCrashReporting(App);
