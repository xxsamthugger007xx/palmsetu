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
} from '../../services/notificationScheduler';

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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [prefs, setPrefs] = React.useState<WellnessNotificationPreferences | null>(null);
  const [permission, setPermission] = React.useState<PermissionState>('undetermined');
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([wellnessApi.getWellnessPreferences(), getNotificationPermissionState()])
      .then(([p, perm]) => { setPrefs(p); setPermission(perm); })
      .catch((err: any) => setError(err.message ?? 'Could not load notification settings.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const askPermission = async () => {
    const status = await requestNotificationPermission();
    setPermission(status);
  };

  const update = <K extends keyof WellnessNotificationPreferences>(field: K, value: WellnessNotificationPreferences[K]) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [field]: value });
  };

  const save = async () => {
    if (!prefs) return;
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

      if (permission === 'granted') {
        const result = await rescheduleWellnessNotifications(saved);
        if (result.skippedQuietHours.length > 0) {
          setStatusMessage(`Saved. Skipped scheduling for ${result.skippedQuietHours.join(', ')} - inside your quiet hours.`);
        } else {
          setStatusMessage('Saved and scheduled.');
        }
      } else {
        setStatusMessage('Saved. Enable notifications above to actually receive these reminders.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Could not save notification settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageContainer><Text variant="bodySm" tone="muted" style={{ marginTop: spacing.sm }}>Loading...</Text></PageContainer>;
  }

  if (error && !prefs) {
    return <PageContainer><EmptyState icon={RefreshCw} title="Something went wrong" description={error} actionLabel="Retry" onAction={load} /></PageContainer>;
  }

  if (!prefs) return null;

  return (
    <PageContainer>
      <Text variant="display" weight="semibold" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>Notifications</Text>
      <Text variant="bodySm" tone="secondary" style={{ marginBottom: spacing.lg }}>
        Local reminders scheduled on this device, based on what you enable below.
      </Text>

      {permission !== 'granted' && (
        <Card style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
          <BellOff size={18} color={color.warning} strokeWidth={1.75} />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text variant="bodySm" weight="semibold">
              {permission === 'denied' ? 'Notifications are off in your device settings' : 'Notifications are not enabled yet'}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {permission === 'denied'
                ? `Turn them on for Solune in your ${Platform.OS === 'ios' ? 'iOS' : 'Android'} settings to receive reminders. Your preferences below are still saved either way.`
                : 'Enable notifications to receive reminders based on the preferences below.'}
            </Text>
            {permission !== 'denied' && (
              <Button label="Enable notifications" icon={Bell} size="sm" onPress={askPermission} style={{ marginTop: spacing.sm }} />
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
                placeholder="HH:mm"
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

      <SectionHeader title="Quiet hours" />
      <Card style={{ marginBottom: spacing.lg }}>
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
          No reminder will be scheduled inside this window. Leave blank for no quiet hours.
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ marginRight: spacing.md }}>
            <Text variant="caption" tone="muted" style={{ marginBottom: 4 }}>Start</Text>
            <TextInput
              value={prefs.quietHoursStart ?? ''}
              onChangeText={(v) => update('quietHoursStart', (v || null) as any)}
              placeholder="22:00"
              placeholderTextColor={color.textMuted}
              style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, width: 100 }}
            />
          </View>
          <View>
            <Text variant="caption" tone="muted" style={{ marginBottom: 4 }}>End</Text>
            <TextInput
              value={prefs.quietHoursEnd ?? ''}
              onChangeText={(v) => update('quietHoursEnd', (v || null) as any)}
              placeholder="07:00"
              placeholderTextColor={color.textMuted}
              style={{ color: color.textPrimary, borderWidth: 1, borderColor: color.border, borderRadius: 8, padding: spacing.sm, width: 100 }}
            />
          </View>
        </View>
      </Card>

      {error && <Text variant="bodySm" tone="danger" style={{ marginBottom: spacing.sm }}>{error}</Text>}
      {statusMessage && <Text variant="bodySm" tone="success" style={{ marginBottom: spacing.sm }}>{statusMessage}</Text>}

      <Button label="Save" onPress={save} loading={saving} fullWidth />
    </PageContainer>
  );
}
