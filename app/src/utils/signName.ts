import type { TFunction } from 'i18next';

/** A zodiac sign's name in the app's language (the server sends English names). Unknown names pass through unchanged. */
export function signName(t: TFunction, sign: string | null | undefined): string {
  if (!sign) return '';
  return t(`signs.${sign}`, { defaultValue: sign }) as string;
}
