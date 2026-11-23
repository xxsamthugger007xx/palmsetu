import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { MailCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { Text } from './Text';
import { color, spacing } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

/**
 * Shown to signed-in accounts whose email isn't verified yet. A verified address matters because it is the only way to
 * recover the account (password reset) and it is what Premium is attached to. Re-checks whenever the screen regains
 * focus, so the card disappears by itself after the user taps the link in their email and comes back to the app.
 */
export function VerifyEmailCard({ style }: { style?: object }) {
  const { t } = useTranslation();
  const { account, isGuest, refresh } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useFocusEffect(
    useCallback(() => {
      if (!isGuest && account && !account.emailVerified) refresh().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGuest, account?.id, account?.emailVerified])
  );

  if (isGuest || !account || account.emailVerified) return null;

  const resend = async () => {
    setState('sending');
    try { await authApi.resendVerification(); setState('sent'); } catch { setState('error'); }
  };

  return (
    <Card elevated style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <MailCheck size={18} color={color.warning} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text variant="bodySm" weight="semibold">{t('ui.VerifyEmailCard.verifyYourEmail')}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {state === 'sent'
              ? t('verifyEmail.sentTo', { email: account.email })
              : state === 'error'
                ? t('verifyEmail.error')
                : t('verifyEmail.prompt', { email: account.email })}
          </Text>
          <Text variant="caption" tone="accent" weight="semibold" accessibilityRole="button"
            onPress={state === 'sending' ? undefined : resend} style={{ marginTop: spacing.xs }}>
            {state === 'sending' ? t('verifyEmail.sending') : state === 'sent' ? t('verifyEmail.again') : t('verifyEmail.send')}
          </Text>
        </View>
      </View>
    </Card>
  );
}
