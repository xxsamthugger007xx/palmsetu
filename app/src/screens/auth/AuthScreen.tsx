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
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

const BENEFITS = [
  'Save your palm profile, Tarot readings and Kundli permanently',
  'Pick up right where you left off, on any device',
  'Never lose a reading when you refresh or reopen the app',
];

export function AuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Auth'>>();
  const { signUp, logIn } = useAuth();

  const [tab, setTab] = useState<'signup' | 'login'>(route.params?.mode ?? 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (tab === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
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
    } catch (err: any) {
      if (err.code === 'EMAIL_TAKEN') setError('An account with this email already exists. Try logging in instead.');
      else if (err.code === 'INVALID_CREDENTIALS') setError('Incorrect email or password.');
      else if (err.code === 'RATE_LIMITED') setError('Too many attempts. Please wait a few minutes and try again.');
      else if (err.code === 'TURNSTILE_FAILED') setError('Verification failed. Please try again.');
      else setError(err.message ?? 'Something went wrong. Please try again.');
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
        <TabButton label="Sign up" active={tab === 'signup'} onPress={() => { setTab('signup'); setError(null); }} />
        <TabButton label="Log in" active={tab === 'login'} onPress={() => { setTab('login'); setError(null); }} />
      </View>

      <View style={styles.fieldWrap}>
        <Mail size={16} color={color.textMuted} strokeWidth={1.75} style={styles.fieldIcon} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Lock size={16} color={color.textMuted} strokeWidth={1.75} style={styles.fieldIcon} />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={tab === 'signup' ? 'Create a password (min. 8 characters)' : 'Password'}
          placeholderTextColor={color.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <TurnstileWidget onToken={setTurnstileToken} />
      </View>

      {error && (
        <Text variant="caption" tone="danger" style={{ marginTop: spacing.sm }}>{error}</Text>
      )}

      <Button
        label={tab === 'signup' ? 'Create account' : 'Log in'}
        fullWidth
        loading={submitting}
        disabled={submitting}
        style={{ marginTop: spacing.lg }}
        onPress={handleSubmit}
      />

      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>Continue as guest</Text>
      <Button label="Continue as guest" variant="secondary" fullWidth style={{ marginTop: spacing.xs }} onPress={continueAsGuest} />

      <Text variant="caption" tone="muted" style={styles.legal}>
        By continuing, you agree to Palm Setu's{' '}
        <Text variant="caption" tone="accent" onPress={() => Linking.openURL('https://example.com/terms')}>Terms of Service</Text>
        {' '}and{' '}
        <Text variant="caption" tone="accent" onPress={() => Linking.openURL('https://example.com/privacy')}>Privacy Policy</Text>.
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
  legal: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
});
