import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, Mail, Lock, ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { TurnstileWidget } from '../../components/TurnstileWidget';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
// The server hosts the legal pages (/terms, /privacy), so the links always match the backend this build talks to.
const LEGAL_BASE = (process.env.EXPO_PUBLIC_LEGAL_BASE_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const BENEFITS = [
  'Save your palm profile, Tarot readings and Kundli permanently',
  'Pick up right where you left off, on any device',
  'Never lose a reading when you refresh or reopen the app',
];

export function AuthScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Auth'>>();
  const { signUp, logIn, signInWithGoogle } = useAuth();

  const [tab, setTab] = useState<'signup' | 'login'>(route.params?.mode ?? 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  // Google is the quick way in; the email form stays tucked away until someone asks for it.
  const [showEmail, setShowEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(t('ui.AuthScreen.enterYourEmailAndPassword'));
      return;
    }
    if (tab === 'signup' && password.length < 8) {
      setError(t('ui.AuthScreen.passwordMustBeAtLeast'));
      return;
    }
    setSubmitting(true);
    try {
      if (tab === 'signup') {
        await signUp(email.trim(), password, turnstileToken ?? undefined);
      } else {
        await logIn(email.trim(), password, turnstileToken ?? undefined);
      }
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
    } catch (__err) {
      const err = asApiError(__err);
      if (err.code === 'EMAIL_TAKEN') setError(t('ui.AuthScreen.anAccountWithThisEmail'));
      else if (err.code === 'INVALID_CREDENTIALS') setError(t('ui.AuthScreen.incorrectEmailOrPassword'));
      else if (err.code === 'RATE_LIMITED') setError(t('ui.AuthScreen.tooManyAttemptsPleaseWait'));
      else if (err.code === 'TURNSTILE_FAILED') setError(t('ui.AuthScreen.verificationFailedPleaseTryAgain'));
      else setError(err.message ?? t('ui.OnboardingAstrologySystemScreen.somethingWentWrongPleaseTry'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle(idToken, turnstileToken ?? undefined);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
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

  const handleForgot = async () => {
    setError(null);
    if (!email.trim()) { setError(t('ui.AuthScreen.enterTheEmailAddressOf')); return; }
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim(), turnstileToken ?? undefined);
      setResetSent(true); // same message whether or not the email has an account
    } catch (__err) {
      const err = asApiError(__err);
      if (err.code === 'RATE_LIMITED') setError(t('ui.AuthScreen.tooManyAttemptsPleaseWait'));
      else if (err.code === 'TURNSTILE_FAILED') setError(t('ui.AuthScreen.verificationFailedPleaseTryAgain'));
      else setError(err.isNetworkError ? err.message : (err.message ?? t('ui.OnboardingAstrologySystemScreen.somethingWentWrongPleaseTry')));
    } finally {
      setSubmitting(false);
    }
  };

  const continueAsGuest = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={continueAsGuest} />
      </View>

      <LinearGradient
        colors={[color.accentMuted, color.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Sparkles size={28} color={color.accent} strokeWidth={1.5} />
        <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {tab === 'signup' ? 'Create your free account' : 'Welcome back'}
        </Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
          {route.params?.intent ?? 'Save your readings and pick up right where you left off.'}
        </Text>
      </LinearGradient>

      {tab === 'signup' && (
        <Card style={{ marginTop: spacing.md }}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <ShieldCheck size={14} color={color.secondary} strokeWidth={1.75} style={{ marginTop: 2 }} />
              <Text variant="caption" tone="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>{b}</Text>
            </View>
          ))}
        </Card>
      )}

      <View style={styles.tabRow}>
        <TabButton label={t('ui.AuthScreen.signUp')} active={tab === 'signup'} onPress={() => { setTab('signup'); setError(null); setForgot(false); setResetSent(false); }} />
        <TabButton label={t('ui.AuthScreen.logIn')} active={tab === 'login'} onPress={() => { setTab('login'); setError(null); setForgot(false); setResetSent(false); }} />
      </View>

      <GoogleSignInButton
        busy={submitting}
        onIdToken={handleGoogleToken}
        onProblem={(kind) => setError(kind === 'not-configured' ? t('authGoogle.notConfigured') : t('authGoogle.failed'))}
      />
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text variant="caption" tone="muted" style={{ marginHorizontal: spacing.sm }}>{t('authGoogle.or')}</Text>
        <View style={styles.orLine} />
      </View>

      {showEmail || forgot ? (
        <>
      <View style={styles.fieldWrap}>
        <Mail size={16} color={color.textMuted} strokeWidth={1.75} style={styles.fieldIcon} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('ui.AuthScreen.emailAddress')} accessibilityLabel={t('ui.AuthScreen.emailAddress')}
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />
      </View>

      {!forgot && <View style={styles.fieldWrap}>
        <Lock size={16} color={color.textMuted} strokeWidth={1.75} style={styles.fieldIcon} />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={tab === 'signup' ? 'Create a password (min. 8 characters)' : 'Password'} accessibilityLabel={tab === 'signup' ? 'Create a password (min. 8 characters)' : 'Password'}
          placeholderTextColor={color.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>}

      {tab === 'login' && !forgot && (
        <Text variant="caption" tone="accent" onPress={() => { setForgot(true); setError(null); setResetSent(false); }}
          accessibilityRole="button" style={{ marginTop: spacing.sm, textAlign: 'right' }}>
          {t('ui.AuthScreen.forgotPassword')}
        </Text>
      )}

      {forgot && (
        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
          {resetSent
            ? "If an account exists for that email, we've sent a link to reset your password. Check your inbox (and spam folder). The link works for 1 hour."
            : "Enter your account's email and we'll send you a link to choose a new password."}
        </Text>
      )}

      <View style={{ marginTop: spacing.sm }}>
        <TurnstileWidget onToken={setTurnstileToken} />
      </View>


      <Button
        label={forgot ? (resetSent ? 'Send again' : 'Send reset link') : tab === 'signup' ? 'Create account' : 'Log in'}
        fullWidth
        loading={submitting}
        disabled={submitting}
        style={{ marginTop: spacing.lg }}
        onPress={forgot ? handleForgot : handleSubmit}
      />
      {forgot && (
        <Text variant="caption" tone="accent" onPress={() => { setForgot(false); setResetSent(false); setError(null); }}
          accessibilityRole="button" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          {t('ui.AuthScreen.backToLogIn')}
        </Text>
      )}

        </>
      ) : (
        <Button label={t('authGoogle.useEmail')} variant="secondary" fullWidth onPress={() => setShowEmail(true)} />
      )}

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>{t('ui.AuthScreen.continueAsGuest')}</Text>
      <Button label={t('ui.AuthScreen.continueAsGuest')} variant="secondary" fullWidth style={{ marginTop: spacing.xs }} onPress={continueAsGuest} />

      <Text variant="caption" tone="muted" style={styles.legal}>
        By continuing, you agree to Palm Setu's{' '}
        <Text variant="caption" tone="accent" onPress={() => Linking.openURL(`${LEGAL_BASE}/terms`)}>{t('ui.AuthScreen.termsOfService')}</Text>
        {' '}and{' '}
        <Text variant="caption" tone="accent" onPress={() => Linking.openURL(`${LEGAL_BASE}/privacy`)}>{t('ui.AuthScreen.privacyPolicy')}</Text>.
      </Text>
    </PageContainer>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Card onPress={onPress} elevated={active} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text variant="bodySm" weight="semibold" tone={active ? 'primary' : 'muted'} style={{ textAlign: 'center' }}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.accentBorder,
    padding: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabButtonActive: {
    borderColor: color.accent,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: color.surfaceElevated,
  },
  fieldIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: color.textPrimary,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: color.border },
  legal: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
});
