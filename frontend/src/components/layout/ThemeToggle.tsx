'use client';

import { memo, useSyncExternalStore } from 'react';
import { useUiCopy } from '@/features/language/useUiCopy';
import { THEME_TOGGLE_MARKUP } from './ThemeToggleMarkup';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'katha-theme-v2';
const THEME_CHANGE_EVENT = 'katha-theme-change';

function readTheme(): Theme {
  const rootTheme = document.documentElement.dataset.theme;
  if (rootTheme === 'light' || rootTheme === 'dark') {
    return rootTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
}

function getThemeSnapshot() {
  return readTheme() === 'dark';
}

function ThemeToggleComponent() {
  const isDark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => false);
  const { copy } = useUiCopy();
  const label = isDark ? copy.enableLightTheme : copy.enableDarkTheme;

  function toggleTheme() {
    const nextTheme = readTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={label}
      title={label}
      className="katha-theme-switch toggle shrink-0"
      dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_MARKUP }}
    />
  );
}

export const ThemeToggle = memo(ThemeToggleComponent);
ThemeToggle.displayName = 'ThemeToggle';
