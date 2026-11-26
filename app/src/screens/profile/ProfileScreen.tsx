import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { signName } from '../../utils/signName';
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
  Moon,
  Flame,
  Crown,
  Sparkles,
  LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PageContainer } from '../../components/PageContainer';
import { AiUsageMeter } from '../../components/AiUsageMeter';
import { VerifyEmailCard } from '../../components/VerifyEmailCard';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { AIAvatar } from '../../components/AIAvatar';
import { AvatarPickerModal } from '../../components/AvatarPickerModal';
import { color, featureTint, radius, spacing } from '../../theme/tokens';
import { FadeInUp } from '../../components/FadeInUp';
import { SettingsRow } from './SettingsRow';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { InfoModal } from '../../components/InfoModal';
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
import { appLocale } from '../../utils/locale';
import { restorePurchases } from '../../services/purchases';
import { asApiError } from '../../services/apiRequest';

const LEGAL_BASE = (process.env.EXPO_PUBLIC_LEGAL_BASE_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@palmsetu.com';

/** The hidden admin gesture only exists in development builds (or when explicitly enabled), so store reviewers and
 * curious users in a release build never find it. Set EXPO_PUBLIC_ENABLE_ADMIN=true to ship it deliberately. */
const ADMIN_ENTRY_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ADMIN === 'true';

function GroupLabel({ children }: { children: string }) {
  return <Text variant="label" tone="muted" style={{ marginBottom: spacing.sm, marginTop: spacing.lg }}>{children}</Text>;
}

function HeaderChip({ icon: Icon, label, tint }: { icon: LucideIcon; label: string; tint: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: 'rgba(255,255,255,0.04)' }}>
      <Icon size={13} color={tint} strokeWidth={2} />
      <Text variant="caption" weight="semibold" style={{ marginLeft: 5, color: tint }}>{label}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, clearProfile, setAvatarKey } = useUserProfile();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const { isGuest, account, logOut, deleteAccount } = useAuth();
  const { languageCode } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRescan, setConfirmRescan] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; description: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
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

  const moonSign = birthProfile ? (birthProfile.preferredSystem === 'vedic' ? birthProfile.natal.moonSignSidereal : birthProfile.natal.moonSignTropical) : null;

  const birthDetailsSummary = birthProfile
    ? [
      birthProfile.preferredSystem === 'vedic' ? 'Vedic' : 'Western',
      new Date(`${birthProfile.birthDate}T00:00:00`).toLocaleDateString(appLocale(), { year: 'numeric', month: 'short', day: 'numeric' }),
      birthProfile.birthTime
        ? (() => { const [h, m] = birthProfile.birthTime!.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }); })()
        : 'time unknown',
      birthProfile.birthPlace ?? undefined,
    ].filter(Boolean).join(', ')
    : 'Not set up yet';

  return (
    <PageContainer onRefresh={loadProfileData}>
      <FadeInUp>
      <LinearGradient
        colors={[color.surfaceElevated, color.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: tier === 'premium' ? color.goldBorder : color.border }}
      >
        {/* Long-press opens the hidden admin panel. Not a documented gesture
            anywhere in the UI - see navigation/RootNavigator.tsx comment. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change avatar"
          onPress={() => setShowAvatarPicker(true)}
          onLongPress={ADMIN_ENTRY_ENABLED ? () => navigation.navigate('AdminEntry') : undefined}
          delayLongPress={1200}
        >
          <AIAvatar name={profile.name} gender={profile.gender} avatarIndex={profile.avatarIndex} avatarKey={profile.avatarKey} size={72} />
        </Pressable>
        <Text variant="caption" tone="accent" weight="semibold" style={{ marginTop: spacing.xs }} onPress={() => setShowAvatarPicker(true)}>
          Change avatar
        </Text>
        <Text variant="title" weight="semibold" style={{ marginTop: spacing.sm }}>{profile.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
          {moonSign && <HeaderChip icon={Moon} label={t('home.moonInSign', { sign: signName(t, moonSign) })} tint={color.accent} />}
          {streakDays > 0 && <HeaderChip icon={Flame} label={`${streakDays} ${t('streak.dayStreak')}`} tint={color.gold} />}
          {tier && <HeaderChip icon={tier === 'premium' ? Crown : Sparkles} label={tier === 'premium' ? t('profile.planPremium') : t('profile.planFree')} tint={tier === 'premium' ? color.gold : color.textSecondary} />}
        </View>
      </LinearGradient>
      </FadeInUp>

      <FadeInUp delay={80}>
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
      </FadeInUp>

      <FadeInUp delay={160}>
      <GroupLabel>{t('profile.account')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={User} label={t('profile.personalInfo')} tint={featureTint.astrology} onPress={() => navigation.navigate('EditProfile')} />
        <SettingsRow icon={Calendar} label={t('profile.birthDetails')} description={birthDetailsSummary} tint={featureTint.astrology} onPress={() => navigation.navigate('AstrologyProfileSetup', { returnTo: 'profile' })} />
        <SettingsRow icon={Shield} label={t('profile.accountManagement')} tint={featureTint.astrology} onPress={() => navigation.navigate('AccountManagement')} />
      </Card>

      <GroupLabel>{t('profile.preferences')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={Bell} label={t('profile.notifications')} tint={featureTint.wellness} onPress={() => navigation.navigate('NotificationSettings')} />
        <SettingsRow icon={Palette} label={t('profile.appearance')} tint={featureTint.wellness} onPress={() => navigation.navigate('Appearance')} />
        <SettingsRow icon={Globe} label={t('profile.language')} description={currentLanguageName} tint={featureTint.wellness} onPress={() => navigation.navigate('Language')} />
      </Card>
      </FadeInUp>

      <FadeInUp delay={240}>
      <GroupLabel>{t('profile.subscription')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={CreditCard} label={t('profile.currentPlan')} description={tier === 'premium' ? 'Premium' : tier === 'free' ? 'Free' : undefined} tint={featureTint.guidance} onPress={() => navigation.navigate('Paywall')} />
        <SettingsRow
          icon={RefreshCw}
          label={restoring ? 'Restoring...' : t('profile.restorePurchases')}
          tint={featureTint.guidance}
          onPress={() => {
            if (isGuest) {
              setInfoModal({ title: t('ui.ProfileScreen.createAnAccount'), description: 'Sign in first so a restored purchase can be matched to your account.' });
              return;
            }
            setRestoring(true);
            restorePurchases()
              .then(async ({ appUserId, entitlementActive }) => {
                if (!entitlementActive) {
                  setInfoModal({ title: 'Nothing to restore', description: 'No active purchase was found for this account.' });
                  return;
                }
                await billingApi.confirmPurchase(appUserId);
                await loadProfileData();
                setInfoModal({ title: 'Purchase restored', description: 'Your premium access has been restored.' });
              })
              .catch((__err) => {
                const err = asApiError(__err);
                setInfoModal({ title: 'Could not restore purchases', description: err.message ?? t('ui.ProfileScreen.pleaseTryAgain') });
              })
              .finally(() => setRestoring(false));
          }}
        />
      </Card>

      {hasPalmProfile && (
        <>
          <GroupLabel>{t('profile.palmProfileGroup')}</GroupLabel>
          <Card padded={false}>
            <SettingsRow icon={ScanLine} label={t('profile.rescanPalm')} description={t('profile.rescanPalmDesc')} tint={featureTint.palm} onPress={() => setConfirmRescan(true)} />
          </Card>
        </>
      )}
      </FadeInUp>

      <FadeInUp delay={320}>
      <GroupLabel>{t('profile.privacy')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={FileText} label={t('profile.savedReadings')} tint={featureTint.tarot} onPress={() => navigation.navigate('SavedReadings')} />
        <SettingsRow icon={NotebookPen} label={t('profile.journalData')} tint={featureTint.tarot} onPress={() => navigation.navigate('Journal')} />
        <SettingsRow
          icon={FileDown}
          label={t('profile.exportData')}
          tint={featureTint.tarot}
          onPress={() => {
            if (isGuest) {
              setInfoModal({ title: t('ui.ProfileScreen.createAnAccount'), description: t('ui.ProfileScreen.signUpFirstToExport') });
              return;
            }
            authApi.exportData()
              .then((data) => {
                const counts = Object.entries(data)
                  .filter(([, v]) => Array.isArray(v))
                  .map(([k, v]) => `${k}: ${(v as unknown[]).length}`)
                  .join('\n');
                setInfoModal({ title: t('ui.ProfileScreen.yourData'), description: counts || 'No saved data yet.' });
              })
              .catch(() => setInfoModal({ title: t('ui.ProfileScreen.couldNotExportData'), description: t('ui.ProfileScreen.pleaseTryAgain') }));
          }}
        />
        <SettingsRow
          icon={Trash2}
          label={t('profile.deleteAccount')}
          destructive
          onPress={() => {
            if (isGuest) {
              setInfoModal({ title: t('ui.ProfileScreen.noAccountYet'), description: t('ui.ProfileScreen.youAreBrowsingAsA') });
              return;
            }
            setConfirmDelete(true);
          }}
        />
      </Card>
      </FadeInUp>

      <FadeInUp delay={400}>
      <GroupLabel>{t('profile.support')}</GroupLabel>
      <Card padded={false}>
        <SettingsRow icon={HelpCircle} label={t('profile.help')} tint={featureTint.soulmate} onPress={() => navigation.navigate('Help')} />
        <SettingsRow
          icon={MessageSquare}
          label={t('profile.feedback')}
          tint={featureTint.soulmate}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Solune app feedback')}`)}
        />
        <SettingsRow
          icon={Lock}
          label={t('profile.privacyPolicy')}
          tint={featureTint.soulmate}
          onPress={() => Linking.openURL(`${LEGAL_BASE}/privacy`)}
        />
        {isGuest ? (
          <SettingsRow icon={UserPlus} label={t('profile.signInCreateAccount')} tint={featureTint.soulmate} onPress={() => navigation.navigate('Auth')} />
        ) : (
          <SettingsRow
            icon={LogOut}
            label={t('profile.signOut')}
            tint={featureTint.soulmate}
            onPress={() => {
              logOut();
              clearProfile();
            }}
          />
        )}
      </Card>
      </FadeInUp>

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
            .catch(() => setInfoModal({ title: t('ui.ProfileScreen.couldNotDeleteAccount'), description: t('ui.ProfileScreen.pleaseTryAgain') }));
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

      {infoModal && (
        <InfoModal
          visible
          title={infoModal.title}
          description={infoModal.description}
          onClose={() => setInfoModal(null)}
        />
      )}

      <AvatarPickerModal
        visible={showAvatarPicker}
        selectedKey={profile.avatarKey}
        onSelect={(key) => { setAvatarKey(key).catch(() => {}); }}
        onClose={() => setShowAvatarPicker(false)}
      />
    </PageContainer>
  );
}
