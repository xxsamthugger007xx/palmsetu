import React, { useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../../components/PageContainer';
import { Text } from '../../components/Text';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { TurnstileWidget } from '../../components/TurnstileWidget';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useWelcomeAuth } from '../../context/WelcomeAuthContext';
import { asApiError } from '../../services/apiRequest';

/**
 * One-time screen shown right after the intro carousel, before the guest
 * name/gender form - a chance to sign in with a real Google account from
 * the very start, instead of only discovering that option later (e.g. from
 * Profile's guest banner). "Skip" (or successfully signing in) both
 * permanently dismiss this screen via WelcomeAuthContext, same persisted-
 * flag pattern as the intro carousel - a guest who skips is never shown
 * this again, and can still sign in later from Profile at any time.
 */
export function WelcomeAuthScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signInWithGoogle } = useAuth();
  const { completeWelcomeAuth } = useWelcomeAuth();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSkip = () => {
    completeWelcomeAuth();
  };

  const handleGoogleToken = async (idToken: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle(idToken, turnstileToken ?? undefined);
      await completeWelcomeAuth();
    } catch (__err) {
      const err = asApiError(__err);
      if (err.code === 'GOOGLE_NOT_CONFIGURED') setError(t('authGoogle.notConfigured'));
      else if (err.code === 'RATE_LIMITED') setError(t('ui.AuthScreen.tooManyAttemptsPleaseWait'));
      else if (err.code === 'TURNSTILE_FAILED') setError(t('ui.AuthScreen.verificationFailedPleaseTryAgain'));
      else if (err.code === 'GOOGLE_FAILED') setError(t('authGoogle.failed'));
      else setError(err.isNetworkError ? err.message : (err.message ?? t('authGoogle.failed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <View />
        <Text
          variant="bodySm"
          tone="accent"
          weight="semibold"
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}
        >
          {t('common.skip')}
        </Text>
      </View>

      <LinearGradient
        colors={[color.accentMuted, color.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.logoBadge}>
          <Image source={require('../../../assets/palm-setu-mark.png')} style={styles.logoImage} resizeMode="cover" />
        </View>
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          Sign in to save your journey
        </Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
          Keep your readings synced across devices and never lose them.
        </Text>
      </LinearGradient>

      <View style={{ marginTop: spacing.xl }}>
        <GoogleSignInButton
          busy={submitting}
          onIdToken={handleGoogleToken}
          onProblem={(kind) => setError(kind === 'not-configured' ? t('authGoogle.notConfigured') : t('authGoogle.failed'))}
        />
      </View>

      {error && (
        <Text variant="bodySm" tone="danger" style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {error}
        </Text>
      )}

      <Text
        variant="caption"
        tone="muted"
        style={{ marginTop: spacing.xl, textAlign: 'center' }}
        onPress={handleSkip}
      >
        Not ready? Continue as a guest instead.
      </Text>

      <View style={{ marginTop: spacing.md }}>
        <TurnstileWidget onToken={setTurnstileToken} />
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    borderRadius: 20,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 44,
    height: 44,
  },
});
