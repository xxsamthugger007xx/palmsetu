import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Tiny, safe wrappers: never throw, do nothing on web or devices without a vibration motor.
const on = Platform.OS === 'ios' || Platform.OS === 'android';

/** A light tick, for browsing/zooming through cards. */
export const tick = () => { if (on) Haptics.selectionAsync().catch(() => {}); };
/** A firmer tap, for choosing a card. */
export const tap = () => { if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };
/** A happy double-buzz, for "your cards are ready". */
export const success = () => { if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
