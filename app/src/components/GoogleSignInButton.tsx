import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Text } from './Text';
import { color, radius, spacing } from '../theme/tokens';

// Lets the browser tab that finished the Google sign-in hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

const IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

/** Whether a Google OAuth client ID exists for the platform the app is running on. */
export const googleSignInConfigured = Boolean(
  Platform.OS === 'android' ? IDS.android : Platform.OS === 'ios' ? IDS.ios : IDS.web,
);

interface Props {
  /** Called with the Google ID token once the person has chosen an account. */
  onIdToken: (idToken: string) => void;
  /** Called when Google sign-in is not set up on this build, or the person cancelled/failed. */
  onProblem: (kind: 'not-configured' | 'failed') => void;
  busy?: boolean;
}

/** Google's official four-colour "G" (brand asset, drawn as SVG so it stays sharp at any size). */
function GoogleMark() {
  return (
    <View style={styles.mark}>
      <Svg width={20} height={20} viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </Svg>
    </View>
  );
}

function Face({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('authGoogle.continue')}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator size="small" color="#3c4043" /> : <GoogleMark />}
      <Text variant="bodySm" weight="semibold" style={styles.label}>{t('authGoogle.continue')}</Text>
    </Pressable>
  );
}

// The Google auth hook throws when its client ID is missing, so it lives in a component that only mounts when configured.
function ConfiguredButton({ onIdToken, onProblem, busy }: Props) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: IDS.web,
    androidClientId: IDS.android,
    iosClientId: IDS.ios,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = (response.params as { id_token?: string }).id_token;
      if (idToken) onIdToken(idToken);
      else onProblem('failed');
    } else if (response.type === 'error') {
      onProblem('failed');
    }
    // 'dismiss' / 'cancel' = the person closed the sheet: nothing to report.
  }, [response]);

  return <Face busy={busy} onPress={() => { if (request) promptAsync().catch(() => onProblem('failed')); }} />;
}

/** "Continue with Google". Always visible; if this build has no Google client ID, tapping explains that instead of failing silently. */
export function GoogleSignInButton(props: Props) {
  if (!googleSignInConfigured) return <Face busy={props.busy} onPress={() => props.onProblem('not-configured')} />;
  return <ConfiguredButton {...props} />;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  mark: {
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  label: { color: '#3c4043' },
});
