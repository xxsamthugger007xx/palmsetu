import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OnboardingIntroProvider } from './src/context/OnboardingIntroContext';
import { AdminRoleProvider } from './src/context/AdminRoleContext';
import { useNocturneFonts } from './src/theme/useNocturneFonts';

export default function App() {
  // Fonts load in the background; the system font fallback renders in the
  // meantime so startup is never blocked on a network font fetch.
  useNocturneFonts();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UserProfileProvider>
          <LanguageProvider>
            <OnboardingIntroProvider>
              <AdminRoleProvider>
                <RootNavigator />
              </AdminRoleProvider>
            </OnboardingIntroProvider>
          </LanguageProvider>
        </UserProfileProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
