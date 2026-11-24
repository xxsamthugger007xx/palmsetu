import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Pressable, View } from 'react-native';
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
  ScanLine,
  UserPlus,
} from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { AiUsageMeter } from '../../components/AiUsageMeter';
import { VerifyEmailCard } from '../../components/VerifyEmailCard';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { AIAvatar } from '../../components/AIAvatar';
import { spacing } from '../../theme/tokens';
import { SettingsRow } from './SettingsRow';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { RootStackParamList } from '../../navigation/types';
import { useUserProfile } from '../../context/UserProfileContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../data/languages';
import { streakApi } from '../../services/streakApi';
import { astrologyApi } from '../../services/astrologyApi';
import { BirthProfile } from '../../types/astrology';
import { palmApi } from '../../services/palmApi';
import { billingApi } from '../../services/billingApi';
import { wellnessApi } from '../../services/wellnessApi';

/** The hidden admin gesture only exists in development builds (or when explicitly enabled), so store reviewers and
 * curious users in a release build never find it. Set EXPO_PUBLIC_ENABLE_ADMIN=true to ship it deliberately. */
const ADMIN_ENTRY_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ADMIN === 'true';

function GroupLabel({ children }: { children: string }) {
  return <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>{children}</Text>;
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, clearProfile } = useUserProfile();
  const { isGuest, account, logOut, deleteAccount } = useAuth();
  const { languageCode } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRescan, setConfirmRescan] = useState(false);
  const [hasPalmProfile, setHasPalmProfile] = useState(false);
  const [birthProfile, setBirthProfile] = useState<BirthProfile | null>(null);
  // Real plan + journal streak from the backend (null until loaded; the plan line stays hidden rather than guessing).
  const [tier, setTier] = useState<'free' | 'premium' | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const currentLanguageName = LANGUAGES.find((l) => l.code === languageCode)?.name ?? 'English';

  const loadProfileData = React.useCallback(async () => {
    await astrologyApi.getProfile().then(setBirthProfile).catch(() => {
      // No complete birth profile yet (shouldn't normally happen post-
      // onboarding, but handled honestly rather than crashing this screen).
    });
    await palmApi.getProfile().then(() => setHasPalmProfile(true)).catch(() => setHasPalmProfile(false));
    await billingApi.getStatus().then((b) => setTier(b.tier)).catch(() => setTier(null));
    await streakApi.get().then((r) => setStreakDays(r.current)).catch(() => setStreakDays(0));
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  if (!profile) return null;

  const birthDetailsSummary = birthProfile
    ? [
      birthProfile.preferredSystem === 'vedic' ? 'Vedic' : 'Western',
      new Date(`${birthProfile.birthDate}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      birthProfile.birthTime
        ? (() => { const [h, m] = birthProfile.birthTime!.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); })()
        : 'time unknown',
      birthProfile.birthPlace ?? undefined,
    ].filter(Boolean).join(', ')
    : 'Not set up yet';

  return (
    <PageContainer onRefresh={loadProfileData}>
      <View style={{ alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md }}>
        {/* Long-press opens the hidden admin panel. Not a documented gesture
            anywhere in the UI - see navigation/RootNavigator.tsx comment. */}
        <Pressable accessibilityRole="button" onLongPress={ADMIN_ENTRY_ENABLED ? () => navigation.navigate('AdminEntry') : undefined} delayLongPress={1200}>
          <AIAvatar name={profile.name} gender={profile.gender} size={64} />
        </Pressable>
        <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm }}>{profile.name}</Text>
        {tier && (
          <Text variant="caption" tone="muted">
            {tier === 'premium' ? 'Premium' : 'Free'} plan{streakDays > 0 ? ` · ${streakDays}-day streak` : ''}
          </Text>
        )}
      </View>

      {isGuest ? (
        <Card elevated style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" weight="semibold">{t('profile.guestBannerTitle')}</Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {t('profile.guestBannerDesc')}
            </Text>
          </View>
          <Text
            variant="bodySm"
            tone="accent"
            weight="semibold"
            onPress={() => navigation.navigate('Auth', { mode: 'signup' })}
          >
            {t('profile.signUp')}
          </Text>
        </Card>
      ) : (
        <Card elevated>
          <Text variant="bodySm" weight="semibold">{account?.email}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('profile.signedIn')}</Text>
        </Card>
      )}

      <VerifyEmailCard style={{ marginTop: spacing.md }} />

      {tier !== 'premium' && (
      <Card elevated style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="bodySm" weight="semibold">{t('profile.upgradeTitle')}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{t('profile.upgradeDesc')}</Text>
        </View>
        <Text variant="bodySm" tone="accent" weight="semibold" onPress={() => navigation.navigate('Paywall')}>{t('common.upgrade')}</Text>
      </Card>
      )}

      <AiUsageMeter style={{ marginTop: spacing.md }} />

      <GroupLabel>{t('profile.account')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={User} label={t('profile.personalInfo')} onPress={() => navigation.navigate('EditProfile')} />
        <SettingsRow icon={Calendar} label={t('profile.birthDetails')} description={birthDetailsSummary} onPress={() => navigation.navigate('AstrologyProfileSetup', { returnTo: 'profile' })} />
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
        <SettingsRow icon={CreditCard} label={t('profile.currentPlan')} description={tier === 'premium' ? 'Premium' : tier === 'free' ? 'Free' : undefined} onPress={() => navigation.navigate('Paywall')} />
        <SettingsRow icon={RefreshCw} label={t('profile.restorePurchases')} onPress={() => {}} />
      </Card>

      {hasPalmProfile && (
        <>
          <GroupLabel>{t('profile.palmProfileGroup')}</GroupLabel>
          <Card padded={false}>
            <SettingsRow icon={ScanLine} label={t('profile.rescanPalm')} description={t('profile.rescanPalmDesc')} onPress={() => setConfirmRescan(true)} />
          </Card>
        </>
      )}

      <GroupLabel>{t('profile.privacy')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={FileText} label={t('profile.savedReadings')} onPress={() => {}} />
        <SettingsRow icon={NotebookPen} label={t('profile.journalData')} onPress={() => {}} />
        <SettingsRow
          icon={FileDown}
          label={t('profile.exportData')}
          onPress={() => {
            if (isGuest) {
              Alert.alert(t('ui.ProfileScreen.createAnAccount'), t('ui.ProfileScreen.signUpFirstToExport'));
              return;
            }
            authApi.exportData()
              .then((data) => {
                const counts = Object.entries(data)
                  .filter(([, v]) => Array.isArray(v))
                  .map(([k, v]) => `${k}: ${(v as unknown[]).length}`)
                  .join('\n');
                Alert.alert(t('ui.ProfileScreen.yourData'), counts || 'No saved data yet.');
              })
              .catch(() => Alert.alert(t('ui.ProfileScreen.couldNotExportData'), t('ui.ProfileScreen.pleaseTryAgain')));
          }}
        />
        <SettingsRow
          icon={Trash2}
          label={t('profile.deleteAccount')}
          destructive
          onPress={() => {
            if (isGuest) {
              Alert.alert(t('ui.ProfileScreen.noAccountYet'), t('ui.ProfileScreen.youAreBrowsingAsA'));
              return;
            }
            setConfirmDelete(true);
          }}
        />
      </Card>

      <GroupLabel>{t('profile.support')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={HelpCircle} label={t('profile.help')} onPress={() => {}} />
        <SettingsRow icon={MessageSquare} label={t('profile.feedback')} onPress={() => {}} />
        <SettingsRow icon={Lock} label={t('profile.privacyPolicy')} onPress={() => {}} />
        {isGuest ? (
          <SettingsRow icon={UserPlus} label={t('profile.signInCreateAccount')} onPress={() => navigation.navigate('Auth')} />
        ) : (
          <SettingsRow
            icon={LogOut}
            label={t('profile.signOut')}
            onPress={() => {
              logOut();
              clearProfile();
            }}
          />
        )}
      </Card>

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
            .catch(() => Alert.alert(t('ui.ProfileScreen.couldNotDeleteAccount'), t('ui.ProfileScreen.pleaseTryAgain')));
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmationModal
        visible={confirmRescan}
        title={t('profile.rescanConfirmTitle')}
        description={t('profile.rescanConfirmDesc')}
        confirmLabel={t('profile.rescanConfirm')}
        destructive
        onConfirm={() => {
          setConfirmRescan(false);
          navigation.navigate('PalmIntro', { allowRescan: true });
        }}
        onCancel={() => setConfirmRescan(false)}
      />
    </PageContainer>
  );
}
