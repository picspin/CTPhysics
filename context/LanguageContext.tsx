'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  HTML_LANG,
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  translate,
  type Language,
  type MessageKey,
  type MessageParams,
} from '@/i18n';

export type { Language, MessageKey, MessageParams };

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Typed lookup with zh <-> en fallback. Supports `{name}` placeholders. */
  t: (key: MessageKey, params?: MessageParams) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  // Restore the saved preference after mount (keeps SSR markup deterministic).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(saved)) setLanguageState(saved);
    } catch {
      /* storage unavailable (private mode) - keep default */
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: MessageParams) => translate(language, key, params),
    [language],
  );

  // <html lang> and the document title follow the selected language.
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language];
    document.title = translate(language, 'meta_title');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', translate(language, 'meta_description'));
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
