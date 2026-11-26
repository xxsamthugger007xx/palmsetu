import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Mail, ShieldCheck, KeyRound, LogOut, Trash2, UserPlus } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button, IconButton } from '../../components/Button';
import { SettingsRow } from './SettingsRow';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { InfoModal } from '../../components/InfoModal';
import { color, spacing } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { authApi } from '../../services/authApi';
import { asApiError } from '../../services/apiRequest';

export function AccountManagementScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isGuest, account, logOut, deleteAccount } = useAuth();
  const { clearProfile } = useUserProfile();
  const [sendingReset, setSendingReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; description: string } | null>(null);

  const handleSendReset = async () => {
    if (!account?.email) return;
    setSendingReset(true);
    try {
      await authApi.forgotPassword(account.email, undefined);
      setInfoModal({ title: 'Check your email', description: `We've sent a password reset link to ${account.email}.` });
    } catch (__err) {
      const err = asApiError(__err);
      setInfoModal({ title: 'Could not send reset email', description: err.message ?? 'Please try again.' });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <PageContainer onRefresh={async () => {}}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <Text variant="bodySm" weight="semibold">{t('profile.accountManagement')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isGuest ? (
        <Card elevated style={{ marginTop: spacing.lg }}>
          <Text variant="bodySm" weight="semibold">You're browsing as a guest</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            Create an account to secure your data, sign in on another device, and manage account settings here.
          </Text>
          <Button
            label="Sign up / Log in"
            icon={UserPlus}
            fullWidth
            style={{ marginTop: spacing.md }}
            onPress={() => navigation.navigate('Auth', { mode: 'signup' })}
          />
        </Card>
      ) : (
        <>
          <Card elevated style={{ marginTop: spacing.lg }}>
            <View style={styles.row}>
              <Mail size={16} color={color.accent} strokeWidth={1.75} />
              <Text variant="bodySm" weight="semibold" style={{ marginLeft: spacing.sm }}>{account?.email}</Text>
            </View>
            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <ShieldCheck size={16} color={account?.emailVerified ? color.success : color.warning} strokeWidth={1.75} />
              <Text variant="caption" tone={account?.emailVerified ? 'success' : 'warning'} style={{ marginLeft: spacing.sm }}>
                {account?.emailVerified ? 'Email verified' : 'Email not verified yet'}
              </Text>
            </View>
          </Card>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>SECURITY</Text>
          <Card padded={false}>
            <SettingsRow
              icon={KeyRound}
              label={sendingReset ? 'Sending...' : 'Reset password'}
              description="Send a password reset link to your email"
              onPress={handleSendReset}
            />
            <SettingsRow
              icon={LogOut}
              label={t('profile.signOut')}
              onPress={() => { logOut(); clearProfile(); }}
            />
          </Card>

          <Text variant="label" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>DANGER ZONE</Text>
          <Card padded={false}>
            <SettingsRow
              icon={Trash2}
              label={t('profile.deleteAccount')}
              destructive
              onPress={() => setConfirmDelete(true)}
            />
          </Card>
        </>
      )}

      <ConfirmationModal
        visible={confirmDelete}
        title={t('profile.deleteAccountTitle')}
        description={t('profile.deleteAccountDesc')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          deleteAccount()
            .then(() => clearProfile())
            .catch(() => setInfoModal({ title: 'Could not delete account', description: 'Please try again.' }));
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {infoModal && (
        <InfoModal
          visible
          title={infoModal.title}
          description={infoModal.description}
          onClose={() => setInfoModal(null)}
        />
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
