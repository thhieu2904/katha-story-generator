'use client';

import { useContext } from 'react';
import { ContentLanguageContext } from './ContentLanguageProvider';

export function useContentLanguage() {
  return useContext(ContentLanguageContext);
}
