import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ko from './locales/ko.json';
import it from './locales/it.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import id from './locales/id.json';
import ar from './locales/ar.json';
import zhHans from './locales/zh-Hans.json';

/** Curated language set - every language here has real, hand-translated app
 * content. See data/languages.ts for the matching picker list. */
export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  es: { translation: es },
  fr: { translation: fr },
  ko: { translation: ko },
  it: { translation: it },
  de: { translation: de },
  ja: { translation: ja },
  id: { translation: id },
  ar: { translation: ar },
  'zh-Hans': { translation: zhHans },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
