import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { handleAppStateChange } from './src/services/sessionTracker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OnboardingIntroProvider } from './src/context/OnboardingIntroContext';
import { AdminRoleProvider } from './src/context/AdminRoleContext';
import { AstrologyOnboardingStatusProvider } from './src/context/AstrologyOnboardingStatus';
import { useNocturneFonts } from './src/theme/useNocturneFonts';

export default function App() {
  // Fonts load in the background; the system font fallback renders in the
  // meantime so startup is never blocked on a network font fetch.
  useNocturneFonts();

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
        <AuthProvider>
          <UserProfileProvider>
            <LanguageProvider>
              <OnboardingIntroProvider>
                <AdminRoleProvider>
                  <AstrologyOnboardingStatusProvider>
                    <RootNavigator />
                  </AstrologyOnboardingStatusProvider>
                </AdminRoleProvider>
              </OnboardingIntroProvider>
            </LanguageProvider>
          </UserProfileProvider>
        </AuthProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
