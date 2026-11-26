import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Tiny, safe wrappers: never throw, do nothing on web or devices without a vibration motor.
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const STORAGE_KEY = 'solune.hapticsEnabled';
let enabled = true;

AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => { if (v !== null) enabled = v === 'true'; })
  .catch(() => {});

export function isHapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
  AsyncStorage.setItem(STORAGE_KEY, String(value)).catch(() => {});
}

const on = () => supported && enabled;

/** A light tick, for browsing/zooming through cards. */
export const tick = () => { if (on()) Haptics.selectionAsync().catch(() => {}); };
/** A firmer tap, for choosing a card. */
export const tap = () => { if (on()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };
/** A happy double-buzz, for "your cards are ready". */
export const success = () => { if (on()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
