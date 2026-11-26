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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WellnessNotificationPreferences } from './wellnessApi';
import { tr } from '../utils/tr';

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

// ---------------------------------------------------------------------------------------------------------------
// Engagement reminders: a daily horoscope nudge and a "keep your streak" nudge. Stored on the device only (no server
// push), scheduled locally like the wellness reminders above.
// ---------------------------------------------------------------------------------------------------------------
export interface EngagementPrefs { horoscopeEnabled: boolean; horoscopeTime: string; streakEnabled: boolean; streakTime: string }
export const DEFAULT_ENGAGEMENT_PREFS: EngagementPrefs = { horoscopeEnabled: true, horoscopeTime: '08:00', streakEnabled: true, streakTime: '20:00' };
const ENGAGEMENT_KEY = 'solune.engagementPrefs';
const HOROSCOPE_NOTIFICATION_ID = 'solune-daily-horoscope';
const STREAK_NOTIFICATION_ID = 'solune-streak-reminder';

export async function loadEngagementPrefs(): Promise<EngagementPrefs> {
  try {
    const raw = await AsyncStorage.getItem(ENGAGEMENT_KEY);
    return raw ? { ...DEFAULT_ENGAGEMENT_PREFS, ...JSON.parse(raw) } : DEFAULT_ENGAGEMENT_PREFS;
  } catch {
    return DEFAULT_ENGAGEMENT_PREFS;
  }
}

export async function saveEngagementPrefs(prefs: EngagementPrefs): Promise<void> {
  try { await AsyncStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: prefs just won't persist */ }
}

/** True for a valid 24h HH:mm time. */
export const isValidTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** The next moment (strictly after `from`) the wall clock reads HH:mm, on the day after `from` if `nextDay`. */
export function nextOccurrence(time: string, from: Date, nextDay: boolean): Date {
  const { hour, minute } = parseTime(time);
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (nextDay) d.setDate(d.getDate() + 1);
  else if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * (Re)schedules the engagement reminders. Safe to call often (every app open and whenever settings change): it
 * cancels both first. The streak reminder is a ONE-SHOT for tomorrow at the chosen time, replaced on every open, so a
 * person who opens the app each day never gets nagged, and one who skips a day gets exactly one nudge. Returns what
 * was scheduled; does nothing (and never throws) where notifications aren't available or permitted.
 */
export async function applyEngagementReminders(prefs: EngagementPrefs, streakCurrent: number, now: Date = new Date()): Promise<{ horoscope: boolean; streak: boolean }> {
  const out = { horoscope: false, streak: false };
  const mod = loadNotifications();
  if (!mod) return out;
  ensureHandlerRegistered(mod);
  try {
    await Promise.all([HOROSCOPE_NOTIFICATION_ID, STREAK_NOTIFICATION_ID].map((id) => mod.cancelScheduledNotificationAsync(id).catch(() => {})));
    if ((await getNotificationPermissionState()) !== 'granted') return out;

    if (prefs.horoscopeEnabled && isValidTime(prefs.horoscopeTime)) {
      const t = parseTime(prefs.horoscopeTime);
      await mod.scheduleNotificationAsync({
        identifier: HOROSCOPE_NOTIFICATION_ID,
        content: { title: tr('notifications.horoscopeTitle'), body: tr('notifications.horoscopeBody') },
        trigger: { type: mod.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute },
      });
      out.horoscope = true;
    }
    if (prefs.streakEnabled && streakCurrent > 0 && isValidTime(prefs.streakTime)) {
      await mod.scheduleNotificationAsync({
        identifier: STREAK_NOTIFICATION_ID,
        content: { title: tr('notifications.streakTitle'), body: tr('notifications.streakBody', { count: streakCurrent }) },
        trigger: { type: mod.SchedulableTriggerInputTypes.DATE, date: nextOccurrence(prefs.streakTime, now, true) },
      });
      out.streak = true;
    }
  } catch {
    /* notifications unavailable here: report only what was actually scheduled */
  }
  return out;
}

export const supportsNotifications = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Fires a real local notification immediately (trigger: null), for the
 * Notification Settings screen's "send test notification" action - lets
 * someone verify local notifications actually work in their current
 * runtime (Expo Go or a real build) without waiting for a scheduled time.
 * Requests permission first if not yet granted. Returns false (never
 * throws) if notifications aren't available or permission is refused.
 */
export async function sendTestNotification(): Promise<boolean> {
  const mod = loadNotifications();
  if (!mod) return false;
  ensureHandlerRegistered(mod);
  try {
    let perm = await getNotificationPermissionState();
    if (perm !== 'granted') perm = await requestNotificationPermission();
    if (perm !== 'granted') return false;

    await mod.scheduleNotificationAsync({
      content: { title: 'Test notification', body: 'If you can see this, local notifications are working.' },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}
