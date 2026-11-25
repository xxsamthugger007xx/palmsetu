import i18n from '../i18n';

/** The language the app is showing (not the phone's), so dates, times and numbers read in the same language as the text. */
export function appLocale(): string {
  return i18n.language || 'en';
}
