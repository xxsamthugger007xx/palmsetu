import React from 'react';
import { Platform, Switch, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, BellOff, RefreshCw } from 'lucide-react-native';
import { PageContainer } from '../../components/PageContainer';
import { SectionHeader } from '../../components/SectionHeader';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { color, spacing } from '../../theme/tokens';
import { wellnessApi, WellnessNotificationPreferences } from '../../services/wellnessApi';
import {
  getNotificationPermissionState, requestNotificationPermission,
  rescheduleWellnessNotifications, PermissionState,
  EngagementPrefs, DEFAULT_ENGAGEMENT_PREFS, loadEngagementPrefs, saveEngagementPrefs, applyEngagementReminders,
  isNotificationsAvailable, isValidTime as isValidEngagementTime, sendTestNotification,
} from '../../services/notificationScheduler';
import { useTranslation } from 'react-i18next';

import { asApiError, ApiError } from '../../services/apiRequest';
import { streakApi } from '../../services/streakApi';
import { ListSkeleton } from '../../components/ListSkeleton';
type CategoryKey = 'mood' | 'habit' | 'journal' | 'meditation';

const CATEGORY_META: { key: CategoryKey; label: string; description: string; enabledField: keyof WellnessNotificationPreferences; timeField: keyof WellnessNotificationPreferences }[] = [
  { key: 'mood', label: 'Mood check-in', description: 'Evening reminder to log how you felt today.', enabledField: 'moodReminderEnabled', timeField: 'moodReminderTime' },
  { key: 'habit', label: 'Habits', description: 'Morning nudge to work on your habits.', enabledField: 'habitReminderEnabled', timeField: 'habitReminderTime' },
  { key: 'journal', label: 'Journal', description: 'Evening reminder to write a short entry.', enabledField: 'journalReminderEnabled', timeField: 'journalReminderTime' },
  { key: 'meditation', label: 'Meditation & affirmation', description: 'Morning reminder with your daily affirmation.', enabledField: 'meditationReminderEnabled', timeField: 'meditationReminderTime' },
];

function isValidTime(v: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
}

export function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [prefs, setPrefs] = React.useState<WellnessNotificationPreferences | null>(null);
  const [permission, setPermission] = React.useState<PermissionState>('undetermined');
  const [engagement, setEngagement] = React.useState<EngagementPrefs>(DEFAULT_ENGAGEMENT_PREFS);
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([wellnessApi.getWellnessPreferences(), getNotificationPermissionState(), loadEngagementPrefs()])
      .then(([p, perm, eng]) => { setPrefs(p); setPermission(perm); setEngagement(eng); })
      .catch((err: ApiError) => setError(err.message ?? t('ui.NotificationSettingsScreen.couldNotLoadNotificationSettings')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const askPermission = async () => {
    const status = await requestNotificationPermission();
    setPermission(status);
  };

  const sendTest = async () => {
    setTestResult(null);
    const ok = await sendTestNotification();
    setPermission(await getNotificationPermissionState());
    setTestResult({
      ok,
      message: ok
        ? 'Test notification sent - check your notification tray now.'
        : 'Could not send a test notification (permission denied, or not available in this build).',
    });
  };

  const update = <K extends keyof WellnessNotificationPreferences>(field: K, value: WellnessNotificationPreferences[K]) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [field]: value });
  };

  const save = async () => {
    if (!prefs) return;
    if (!isValidEngagementTime(engagement.horoscopeTime) || !isValidEngagementTime(engagement.streakTime)) {
      setError(t('notifications.invalidTime'));
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    setError(null);
    try {
      const saved = await wellnessApi.saveWellnessPreferences({
        moodReminderEnabled: prefs.moodReminderEnabled,
        moodReminderTime: prefs.moodReminderTime,
        habitReminderEnabled: prefs.habitReminderEnabled,
        habitReminderTime: prefs.habitReminderTime,
        journalReminderEnabled: prefs.journalReminderEnabled,
        journalReminderTime: prefs.journalReminderTime,
        meditationReminderEnabled: prefs.meditationReminderEnabled,
        meditationReminderTime: prefs.meditationReminderTime,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
      });
      setPrefs(saved);
      await saveEngagementPrefs(engagement);
      if (permission === 'granted') {
        const st = await streakApi.get().catch(() => null);
        await applyEngagementReminders(engagement, st?.current ?? 0).catch(() => {});
      }

      if (permission === 'granted') {
        const result = await rescheduleWellnessNotifications(saved);
        if (result.skippedQuietHours.length > 0) {
          setStatusMessage(`Saved. Skipped scheduling for ${result.skippedQuietHours.join(', ')} - inside your quiet hours.`);
        } else {
          setStatusMessage(t('ui.NotificationSettingsScreen.savedAndScheduled'));
        }
      } else {
        setStatusMessage(t('ui.NotificationSettingsScreen.savedEnableNotificationsAboveTo'));
      }
    } catch (__err) {
      const err = asApiError(__err);
      setError(err?.message ?? t('ui.NotificationSettingsScreen.couldNotSaveNotificationSettings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageContainer><ListSkeleton rows={3} /></PageContainer>;
  }

  if (error && !prefs) {
    return <PageContainer><EmptyState icon={RefreshCw} title={t('ui.SoulmateGeneratingScreen.somethingWentWrong')} description={error} actionLabel={t('ui.AstrologyLandingScreen.retry')} onAction={load} /></PageContainer>;
  }

  if (!prefs) return null;

  return (
    <PageContainer onRefresh={load}>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>{t('ui.NotificationSettingsScreen.notifications')}</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.sm }}>
        {t('ui.NotificationSettingsScreen.localRemindersScheduledOnThis')}
      </Text>

      <Button label="Send test notification now" icon={Bell} variant="secondary" size="sm" onPress={sendTest} style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }} />
      {testResult && (
        <Text variant="bodySm" tone={testResult.ok ? 'success' : 'danger'} style={{ marginBottom: spacing.lg }}>
          {testResult.message}
        </Text>
      )}

      {permission !== 'granted' && (
        <Card style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
          <BellOff size={18} color={color.warning} strokeWidth={1.75} />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text variant="bodySm" weight="semibold">
              {permission === 'denied' ? 'Notifications are off in your device settings' : 'Notifications are not enabled yet'}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {permission === 'denied'
                ? `Turn them on for Palm Setu in your ${Platform.OS === 'ios' ? 'iOS' : 'Android'} settings to receive reminders. Your preferences below are still saved either way.`
                : 'Enable notifications to receive reminders based on the preferences below.'}
            </Text>
            {permission !== 'denied' && (
              <Button label={t('ui.NotificationSettingsScreen.enableNotifications')} icon={Bell} size="sm" onPress={askPermission} style={{ marginTop: spacing.sm }} />
            )}
          </View>
        </Card>
      )}

      {CATEGORY_META.map((cat) => {
        const enabled = Boolean(prefs[cat.enabledField]);
        const time = String(prefs[cat.timeField]);
        return (
          <Card key={cat.key} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text variant="bodySm" weight="semibold">{cat.label}</Text>
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{cat.description}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(v) => update(cat.enabledField, v as any)}
                trackColor={{ false: color.surfaceElevated, true: color.accentMuted }}
                thumbColor={enabled ? color.accent : color.textMuted}
              />
            </View>
            {enabled && (
              <TextInput
                value={time}
                onChangeText={(v) => update(cat.timeField, v as any)}
                placeholder={t('ui.NotificationSettingsScreen.hhMm')} accessibilityLabel={t('ui.NotificationSettingsScreen.hhMm')}
                placeholderTextColor={color.textMuted}
                style={{
                  color: isValidTime(time) ? color.textPrimary : color.danger,
                  borderWidth: 1, borderColor: color.border, borderRadius: 8,
                  padding: spacing.sm, marginTop: spacing.sm, width: 100,
                }}
              />
            )}
          </Card>
        );
      })}

      <SectionHeader title={t('notifications.dailyReminders')} />
      {!isNotificationsAvailable() && (
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>{t('notifications.unavailable')}</Text>
      )}
      {([
        { label: t('notifications.horoscopeReminder'), on: 'horoscopeEnabled', time: 'horoscopeTime' },
        { label: t('notifications.streakReminder'), on: 'streakEnabled', time: 'streakTime' },
      ] as const).map((row) => (
        <Card key={row.on} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodySm" weight="semibold" style={{ flex: 1, marginRight: spacing.sm }}>{row.label}</Text>
            <Switch
              value={engagement[row.on]}
              onValueChange={(v) => setEngagement({ ...engagement, [row.on]: v })}
              accessibilityLabel={row.label}
              trackColor={{ false: color.surfaceElevated, true: color.accentMuted }}
              thumbColor={engagement[row.on] ? color.accent : color.textMuted}
            />
          </View>
          {engagement[row.on] && (
            <TextInput
              value={engagement[row.time]}
              onChangeText={(v) => setEngagement({ ...engagement, [row.time]: v })}
              accessibilityLabel={`${row.label} - ${t('notifications.timeLabel')}`}
              placeholder="08:00"
              placeholderTextColor={color.textMuted}
              style={{
                color: isValidEngagementTime(engagement[row.time]) ? color.textPrimary : color.danger,
                borderWidth: 1, borderColor: color.border, borderRadius: 8,
                padding: spacing.sm, marginTop: spacing.sm, width: 100,
              }}
            />
          )}
        </Card>
      ))}

      <SectionHeader title={t('ui.NotificationSettingsScreen.quietHours')} />
      <Card style={{ marginBottom: spacing.lg }}>
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
          {t('ui.NotificationSettingsScreen.noReminderWillBeScheduled')}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginRight: spacing.md }}>
            <Text variant="caption" tone="muted" style={{ marginBottom: 4 }}>{t('ui.NotificationSettingsScreen.start')}</Text>
            <TextInput
              value={prefs.quietHoursStart ?? ''}
              onChangeText={(v) => update('quietHoursStart', (v || null) as any)}
              placeholder="22:00" accessibilityLabel="22:00"
              placeholderTextColor={color.textMuted}
              style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, width: 100 }}
            />
          </View>
          <View>
            <Text variant="caption" tone="muted" style={{ marginBottom: 4 }}>{t('ui.NotificationSettingsScreen.end')}</Text>
            <TextInput
              value={prefs.quietHoursEnd ?? ''}
              onChangeText={(v) => update('quietHoursEnd', (v || null) as any)}
              placeholder="07:00" accessibilityLabel="07:00"
              placeholderTextColor={color.textMuted}
              style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, width: 100 }}
            />
          </View>
        </View>
      </Card>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}
      {statusMessage && <Text variant="bodySm" tone="success" style={{ marginBottom: spacing.sm }}>{statusMessage}</Text>}

      <Button label={t('ui.GoalDetailScreen.save')} onPress={save} loading={saving} fullWidth />
    </PageContainer>
  );
}
