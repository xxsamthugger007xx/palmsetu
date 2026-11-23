import i18n from '../i18n';

/** Translate outside React components/hooks (e.g. for accessibility labels on one-off elements). */
export const tr = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options) as string;
