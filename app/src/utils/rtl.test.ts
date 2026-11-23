import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ I18nManager: { isRTL: false } }));
import { isRtlLanguage } from './rtl';

describe('isRtlLanguage', () => {
  it('is true for right-to-left languages, including regional variants', () => {
    for (const c of ['ar', 'ar-SA', 'he', 'fa', 'ur']) expect(isRtlLanguage(c)).toBe(true);
  });
  it('is false for everything else the app ships', () => {
    for (const c of ['en', 'hi', 'es', 'fr', 'ko', 'it', 'de', 'ja', 'id', 'zh-Hans']) expect(isRtlLanguage(c)).toBe(false);
  });
});
