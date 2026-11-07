export interface Language {
  code: string; // BCP-47-ish primary subtag
  name: string; // English name
  nativeName: string;
  flag: string; // emoji flag of a representative country for this language
}

/** Supported languages for the Profile > Language picker and the first-launch
 * language selector. Every language listed here has full translated app content
 * (see src/i18n) - this list is intentionally curated, not the full set of world
 * languages.
 *
 * Order here is deliberate (English first, Hindi second, then the rest) and is
 * NOT re-sorted alphabetically - preserve this order when editing the list. */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'zh-Hans', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

/** Every language above has real translated app content (see src/i18n). */
export const SUPPORTED_TRANSLATION_CODES = [
  'en', 'hi', 'es', 'fr', 'ko', 'it', 'de', 'ja', 'id', 'ar', 'zh-Hans',
] as const;
