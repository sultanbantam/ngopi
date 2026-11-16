import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from './storage';
import { syncAndroidLanguageCode } from '../components/cekkes/nativeAndroidBridge';

export type AppLanguage = 'id' | 'en';
const LANG_KEY = 'ngopi_lang';
const LEGACY_LANG_KEY = 'ngopi_app_language';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  toggleLang: () => void;
  t: (idText: string, enText: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'id',
  setLang: () => {},
  toggleLang: () => {},
  t: (idText) => idText,
});

function readInitialLang(): AppLanguage {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem(LANG_KEY) || window.localStorage.getItem(LEGACY_LANG_KEY);
      if (v === 'en' || v === 'id') return v;
    }
  } catch {
    // ignore
  }
  return 'id';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(readInitialLang);

  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY)
      .then((v) => {
        if (v === 'en' || v === 'id') setLangState(v);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANG_KEY, next);
      }
    } catch {
      // ignore
    }
    SecureStore.setItemAsync(LANG_KEY, next).catch(() => {});
    syncAndroidLanguageCode(next).catch(() => {});
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'id' ? 'en' : 'id');
  }, [lang, setLang]);

  const t = useCallback(
    (idText: string, enText: string) => (lang === 'en' ? enText : idText),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
