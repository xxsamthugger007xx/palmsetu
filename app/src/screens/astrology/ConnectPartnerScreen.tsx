import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Copy, Clock } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { color, radius, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { astrologyApi } from '../../services/astrologyApi';
import { useTranslation } from 'react-i18next';

import { asApiError } from '../../services/apiRequest';
type Mode = 'choose' | 'generated' | 'enter';

export function ConnectPartnerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await astrologyApi.createInvitation();
      setCode(res.code);
      setExpiresAt(res.expiresAt);
      setMode('generated');
    } catch (__err) {
      const err = asApiError(__err);
      setError(err.message ?? t('ui.ConnectPartnerScreen.couldNotCreateAnInvitation'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!enteredCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await astrologyApi.acceptInvitation(enteredCode.trim().toUpperCase());
      navigation.replace('Relationships');
    } catch (__err) {
      const err = asApiError(__err);
      setError(err.message ?? t('ui.ConnectPartnerScreen.couldNotAcceptThisInvitation'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
      </View>

      <Text variant="title" weight="semibold" style={{ marginTop: spacing.md }}>{t('ui.ConnectPartnerScreen.connectWithPartner')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {t('ui.ConnectPartnerScreen.yourPartnerWillNeedTheir')}
      </Text>

      {mode === 'choose' && (
        <>
          <Card onPress={handleGenerate} style={{ marginBottom: spacing.sm }}>
            <Text variant="bodySm" weight="semibold">{t('ui.ConnectPartnerScreen.generateAnInvitation')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('ui.ConnectPartnerScreen.createACodeToShare')}</Text>
          </Card>
          <Card onPress={() => setMode('enter')}>
            <Text variant="bodySm" weight="semibold">{t('ui.ConnectPartnerScreen.enterACode')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('ui.ConnectPartnerScreen.yourPartnerSharedACode')}</Text>
          </Card>
        </>
      )}

      {mode === 'generated' && code && (
        <Card elevated style={{ alignItems: 'center' }}>
          <Text variant="label" tone="muted">{t('ui.ConnectPartnerScreen.yourInvitationCode')}</Text>
          <Text variant="display" weight="bold" style={styles.codeText}>{code}</Text>
          <View style={styles.row}>
            <Clock size={13} color={color.textMuted} strokeWidth={1.75} />
            <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>
              Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : ''}
            </Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {t('ui.ConnectPartnerScreen.shareThisCodeDirectlyWith')}
          </Text>
          <Button label={copied ? 'Copied!' : 'Copy code'} icon={Copy} variant="secondary" size="sm" style={{ marginTop: spacing.md }} onPress={handleCopy} />
        </Card>
      )}

      {mode === 'enter' && (
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>{t('ui.ConnectPartnerScreen.invitationCode')}</Text>
          <TextInput
            value={enteredCode}
            onChangeText={(t) => setEnteredCode(t.toUpperCase())}
            placeholder={t('ui.ConnectPartnerScreen.eGY5ppbubg')} accessibilityLabel={t('ui.ConnectPartnerScreen.eGY5ppbubg')}
            placeholderTextColor={color.textMuted}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Card style={{ marginTop: spacing.md }}>
            <Text variant="bodySm" weight="semibold">{t('ui.ConnectPartnerScreen.whatYouLlBeSharing')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              {t('ui.ConnectPartnerScreen.onceConnectedYouCanEach')}
            </Text>
          </Card>
          <Button label={t('ui.ConnectPartnerScreen.acceptInvitation')} fullWidth loading={loading} style={{ marginTop: spacing.lg }} onPress={handleAccept} />
        </View>
      )}

      {error && (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="caption" tone="danger">{error}</Text>
        </Card>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  codeText: { letterSpacing: 4, marginVertical: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: color.textPrimary,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: 'center',
  },
});
