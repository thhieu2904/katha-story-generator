'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export type ContentLanguage = 'km' | 'vi';

interface ContentLanguageContextValue {
  language: ContentLanguage;
  setLanguage: (language: ContentLanguage) => void;
}

const STORAGE_KEY = 'katha-content-language-v1';

export const ContentLanguageContext = createContext<ContentLanguageContextValue>({
  language: 'vi',
  setLanguage: () => {},
});

export function ContentLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<ContentLanguage>('vi');

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
      if (savedLanguage === 'km' || savedLanguage === 'vi') {
        setLanguageState(savedLanguage);
        document.documentElement.dataset.contentLanguage = savedLanguage;
        document.documentElement.lang = savedLanguage;
      } else {
        document.documentElement.dataset.contentLanguage = 'vi';
        document.documentElement.lang = 'vi';
      }
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);

  const setLanguage = useCallback((nextLanguage: ContentLanguage) => {
    setLanguageState(nextLanguage);
    document.documentElement.dataset.contentLanguage = nextLanguage;
    document.documentElement.lang = nextLanguage;
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // Keep the in-memory language when browser storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <ContentLanguageContext.Provider value={value}>
      {children}
    </ContentLanguageContext.Provider>
  );
}
