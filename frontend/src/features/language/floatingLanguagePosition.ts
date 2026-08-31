export const FLOATING_LANGUAGE_POSITION_STORAGE_KEY =
  'katha-language-toggle-position-v1';

export interface FloatingLanguagePosition {
  left: number;
  top: number;
}

export function loadFloatingLanguagePosition(): Partial<FloatingLanguagePosition> | null {
  if (typeof window === 'undefined') return null;

  try {
    // Remove the former persistent value so existing users also start each
    // authentication session from the default position.
    window.localStorage.removeItem(FLOATING_LANGUAGE_POSITION_STORAGE_KEY);
    return JSON.parse(
      window.sessionStorage.getItem(FLOATING_LANGUAGE_POSITION_STORAGE_KEY) ?? 'null',
    ) as Partial<FloatingLanguagePosition> | null;
  } catch {
    try {
      window.sessionStorage.removeItem(FLOATING_LANGUAGE_POSITION_STORAGE_KEY);
    } catch {
      // Use the default position when browser storage is unavailable.
    }
    return null;
  }
}

export function saveFloatingLanguagePosition(position: FloatingLanguagePosition) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    FLOATING_LANGUAGE_POSITION_STORAGE_KEY,
    JSON.stringify(position),
  );
}

export function clearFloatingLanguagePosition() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FLOATING_LANGUAGE_POSITION_STORAGE_KEY);
    window.localStorage.removeItem(FLOATING_LANGUAGE_POSITION_STORAGE_KEY);
  } catch {
    // The in-memory component position disappears with the current page.
  }
}
