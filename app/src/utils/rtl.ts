import { I18nManager } from 'react-native';

/** Languages written right-to-left. Only Arabic ships today; the others are listed so adding one needs no code change. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

export const isRtlLanguage = (code: string): boolean => RTL_LANGUAGES.has(code.split('-')[0]);

/** True if the running app is currently laid out right-to-left. */
export const isRtlLayout = (): boolean => I18nManager.isRTL;
