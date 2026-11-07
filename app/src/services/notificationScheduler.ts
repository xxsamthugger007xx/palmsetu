/**
 * Real local notification scheduling for the Wellness module, driven by the
 * server-stored preferences (GET|PUT /wellness/preferences). There is no
 * server push service in this app - every notification here is scheduled
 * on-device with expo-notifications' local scheduling API.
 *
 * IMPORTANT: expo-notifications' native module is not present in the generic
 * Expo Go client on current SDK versions (Expo removed it from Expo Go -
 * it now requires a custom development build). A plain top-level
 * `import * as Notifications from 'expo-notifications'` throws immediately
 * at module-load time in that environment, and since this file is reachable
 * from RootNavigator's static import chain, that crash would take down the
 * entire app on launch, not just the one screen that uses notifications.
 * So the module is loaded lazily via `require()` inside a try/catch, only
 * when a function below is actually called - never at import time.
 */
import { Platform } from 'react-native';
import { WellnessNotificationPreferences } from './wellnessApi';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NotificationsModule: any = null;
let loadAttempted = false;
let handlerRegistered = false;

/** Returns the native module, or null if it genuinely is not available in
 * this runtime (e.g. Expo Go without a custom dev build) - callers must
 * treat null as "notifications are not available here," never crash. */
function loadNotifications(): any {
  if (loadAttempted) return NotificationsModule;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    NotificationsModule = require('expo-notifications');
  } catch {
    NotificationsModule = null;
  }
  return NotificationsModule;
}

function ensureHandlerRegistered(mod: any) {
  if (handlerRegistered || !mod) return;
  handlerRegistered = true;
  try {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Native module loaded but handler registration failed - every exported
    // function below already treats this as the honest "not available" case.
  }
}

/** True once we know (by having tried) whether real notification scheduling
 * can work in this runtime. Screens can use this to show an honest
 * "not available in this build" state instead of a broken-looking toggle. */
export function isNotificationsAvailable(): boolean {
  return loadNotifications() != null;
}

export async function getNotificationPermissionState(): Promise<PermissionState> {
  const mod = loadNotifications();
  if (!mod) return 'denied';
  ensureHandlerRegistered(mod);
  try {
    const { status } = await mod.getPermissionsAsync();
    return status as PermissionState;
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  const mod = loadNotifications();
  if (!mod) return 'denied';
  ensureHandlerRegistered(mod);
  try {
    const { status } = await mod.requestPermissionsAsync();
    return status as PermissionState;
  } catch {
    return 'denied';
  }
}

/** Category ids this module schedules reminders for. Each maps to one
 * preference pair (enabled flag + time) on WellnessNotificationPreferences. */
const CATEGORY_NOTIFICATION_IDS = {
  mood: 'solune-wellness-mood-reminder',
  habit: 'solune-wellness-habit-reminder',
  journal: 'solune-wellness-journal-reminder',
  meditation: 'solune-wellness-meditation-reminder',
} as const;

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
}

/** Quiet hours are a local HH:mm window, possibly wrapping past midnight
 * (e.g. 22:00 -> 07:00). Returns true if the given HH:mm time falls inside it. */
function isWithinQuietHours(time: { hour: number; minute: number }, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const t = time.hour * 60 + time.minute;
  const s = parseTime(start);
  const e = parseTime(end);
  const startMin = s.hour * 60 + s.minute;
  const endMin = e.hour * 60 + e.minute;
  if (startMin === endMin) return false;
  if (startMin < endMin) return t >= startMin && t < endMin;
  // Wraps past midnight.
  return t >= startMin || t < endMin;
}

const CATEGORY_CONTENT: Record<keyof typeof CATEGORY_NOTIFICATION_IDS, { title: string; body: string }> = {
  mood: { title: 'How are you feeling?', body: 'Take a moment for a quick mood check-in.' },
  habit: { title: 'Habit reminder', body: 'A gentle nudge to work on your habits today.' },
  journal: { title: 'Time to reflect', body: 'Write a short journal entry about your day.' },
  meditation: { title: 'Morning affirmation ready', body: 'Your daily inspiration and a short session are ready when you are.' },
};

/**
 * Cancels any previously scheduled Wellness reminders and reschedules them
 * from scratch based on the current preferences. Called whenever
 * preferences are saved, and once on app start. Any category whose time
 * falls inside the quiet-hours window is skipped - never scheduled, not
 * scheduled-then-silenced. Returns empty results, not an error, when
 * notifications are not available in this runtime (e.g. Expo Go).
 */
export async function rescheduleWellnessNotifications(prefs: WellnessNotificationPreferences): Promise<{ scheduled: string[]; skippedQuietHours: string[] }> {
  const scheduled: string[] = [];
  const skippedQuietHours: string[] = [];

  const mod = loadNotifications();
  if (!mod) return { scheduled, skippedQuietHours };
  ensureHandlerRegistered(mod);

  try {
    await Promise.all(
      Object.values(CATEGORY_NOTIFICATION_IDS).map((id) => mod.cancelScheduledNotificationAsync(id).catch(() => {})),
    );

    const perms = await getNotificationPermissionState();
    if (perms !== 'granted') return { scheduled, skippedQuietHours };

    const categories: { key: keyof typeof CATEGORY_NOTIFICATION_IDS; enabled: boolean; time: string }[] = [
      { key: 'mood', enabled: prefs.moodReminderEnabled, time: prefs.moodReminderTime },
      { key: 'habit', enabled: prefs.habitReminderEnabled, time: prefs.habitReminderTime },
      { key: 'journal', enabled: prefs.journalReminderEnabled, time: prefs.journalReminderTime },
      { key: 'meditation', enabled: prefs.meditationReminderEnabled, time: prefs.meditationReminderTime },
    ];

    for (const cat of categories) {
      if (!cat.enabled) continue;
      const time = parseTime(cat.time);
      if (isWithinQuietHours(time, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        skippedQuietHours.push(cat.key);
        continue;
      }
      const content = CATEGORY_CONTENT[cat.key];
      await mod.scheduleNotificationAsync({
        identifier: CATEGORY_NOTIFICATION_IDS[cat.key],
        content: { title: content.title, body: content.body },
        trigger: {
          type: mod.SchedulableTriggerInputTypes.DAILY,
          hour: time.hour,
          minute: time.minute,
        },
      });
      scheduled.push(cat.key);
    }
  } catch {
    // Notifications unavailable in this environment - return whatever was
    // genuinely scheduled before the failure, never fabricate success.
  }

  return { scheduled, skippedQuietHours };
}

export async function cancelAllWellnessNotifications(): Promise<void> {
  const mod = loadNotifications();
  if (!mod) return;
  try {
    await Promise.all(
      Object.values(CATEGORY_NOTIFICATION_IDS).map((id) => mod.cancelScheduledNotificationAsync(id).catch(() => {})),
    );
  } catch {
    // Notifications unavailable in this environment - nothing to cancel.
  }
}

export const supportsNotifications = Platform.OS === 'ios' || Platform.OS === 'android';
