import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { LANGUAGES, SUPPORTED_TRANSLATION_CODES } from '../data/languages';

const STORAGE_KEY = 'solune.languageCode';
const HAS_SELECTED_KEY = 'solune.hasSelectedLanguage';
const DEFAULT_LANGUAGE = 'en';

interface LanguageContextValue {
  languageCode: string;
  setLanguageCode: (code: string) => Promise<void>;
  loading: boolean;
  isTranslated: boolean; // false = this language falls back to English UI text
  hasSelectedLanguage: boolean; // false = first launch, hasn't gone through the picker yet
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function applyToI18n(code: string) {
  const effective = (SUPPORTED_TRANSLATION_CODES as readonly string[]).includes(code) ? code : DEFAULT_LANGUAGE;
  i18n.changeLanguage(effective);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [languageCode, setLanguageCodeState] = useState(DEFAULT_LANGUAGE);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(HAS_SELECTED_KEY)])
      .then(([savedCode, savedHasSelected]) => {
        if (savedCode && LANGUAGES.some((l) => l.code === savedCode)) {
          setLanguageCodeState(savedCode);
          applyToI18n(savedCode);
        }
        if (savedHasSelected === 'true') setHasSelectedLanguage(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const setLanguageCode = async (code: string) => {
    setLanguageCodeState(code);
    applyToI18n(code);
    setHasSelectedLanguage(true);
    await AsyncStorage.setItem(STORAGE_KEY, code);
    await AsyncStorage.setItem(HAS_SELECTED_KEY, 'true');
  };

  const isTranslated = (SUPPORTED_TRANSLATION_CODES as readonly string[]).includes(languageCode);

  return (
    <LanguageContext.Provider value={{ languageCode, setLanguageCode, loading, isTranslated, hasSelectedLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
