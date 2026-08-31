'use client';

import { useContentLanguage } from './useContentLanguage';
import { getUiCopy } from './uiCopy';

export function useUiCopy() {
  const { language } = useContentLanguage();
  return { copy: getUiCopy(language), language };
}
