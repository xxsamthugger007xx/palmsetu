import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  User,
  Calendar,
  Shield,
  Bell,
  Palette,
  Globe,
  CreditCard,
  RefreshCw,
  FileDown,
  NotebookPen,
  Trash2,
  HelpCircle,
  MessageSquare,
  FileText,
  Lock,
  LogOut,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { AIAvatar } from '../../components/AIAvatar';
import { spacing } from '../../theme/tokens';
import { SettingsRow } from './SettingsRow';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { mockUser } from '../../data/mock';
import { RootStackParamList } from '../../navigation/types';
import { useUserProfile } from '../../context/UserProfileContext';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../data/languages';

function GroupLabel({ children }: { children: string }) {
  return <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>{children}</Text>;
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, clearProfile } = useUserProfile();
  const { languageCode } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const currentLanguageName = LANGUAGES.find((l) => l.code === languageCode)?.name ?? 'English';

  if (!profile) return null;

  return (
    <PageContainer>
      <View style={{ alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md }}>
        {/* Long-press opens the hidden admin panel. Not a documented gesture
            anywhere in the UI - see navigation/RootNavigator.tsx comment. */}
        <Pressable onLongPress={() => navigation.navigate('AdminEntry')} delayLongPress={1200}>
          <AIAvatar name={profile.name} gender={profile.gender} size={64} />
        </Pressable>
        <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm }}>{profile.name}</Text>
        <Text variant="caption" tone="muted">{mockUser.plan} plan · {mockUser.streakDays}-day streak</Text>
      </View>

      <Card elevated style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="bodySm" weight="semibold">{t('profile.upgradeTitle')}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('profile.upgradeDesc')}</Text>
        </View>
        <Text variant="bodySm" tone="accent" weight="semibold" onPress={() => navigation.navigate('Paywall')}>{t('common.upgrade')}</Text>
      </Card>

      <GroupLabel>{t('profile.account')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={User} label={t('profile.personalInfo')} onPress={() => navigation.navigate('EditProfile')} />
        <SettingsRow icon={Calendar} label={t('profile.birthDetails')} description={t('profile.birthDetailsDesc')} onPress={() => navigation.navigate('AstrologyProfileSetup', { returnTo: 'profile' })} />
        <SettingsRow icon={Shield} label={t('profile.accountManagement')} onPress={() => {}} />
      </Card>

      <GroupLabel>{t('profile.preferences')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={Bell} label={t('profile.notifications')} onPress={() => {}} />
        <SettingsRow icon={Palette} label={t('profile.appearance')} onPress={() => {}} />
        <SettingsRow icon={Globe} label={t('profile.language')} description={currentLanguageName} onPress={() => navigation.navigate('Language')} />
      </Card>

      <GroupLabel>{t('profile.subscription')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={CreditCard} label={t('profile.currentPlan')} description={mockUser.plan} onPress={() => navigation.navigate('Paywall')} />
        <SettingsRow icon={RefreshCw} label={t('profile.restorePurchases')} onPress={() => {}} />
      </Card>

      <GroupLabel>{t('profile.privacy')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={FileText} label={t('profile.savedReadings')} onPress={() => {}} />
        <SettingsRow icon={NotebookPen} label={t('profile.journalData')} onPress={() => {}} />
        <SettingsRow icon={FileDown} label={t('profile.exportData')} onPress={() => {}} />
        <SettingsRow icon={Trash2} label={t('profile.deleteAccount')} destructive onPress={() => setConfirmDelete(true)} />
      </Card>

      <GroupLabel>{t('profile.support')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={HelpCircle} label={t('profile.help')} onPress={() => {}} />
        <SettingsRow icon={MessageSquare} label={t('profile.feedback')} onPress={() => {}} />
        <SettingsRow icon={Lock} label={t('profile.privacyPolicy')} onPress={() => {}} />
        <SettingsRow icon={LogOut} label={t('profile.signOut')} onPress={clearProfile} />
      </Card>

      <ConfirmationModal
        visible={confirmDelete}
        title={t('profile.deleteAccountTitle')}
        description={t('profile.deleteAccountDesc')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => setConfirmDelete(false)}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}
