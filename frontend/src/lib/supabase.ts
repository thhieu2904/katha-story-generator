import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const AUTH_STORAGE_KEY = 'katha-auth-session-v1';

function getProjectRef(url: string) {
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  if (typeof window === 'undefined') return undefined;

  const projectRef = getProjectRef(supabaseUrl);
  if (projectRef) {
    // Remove the previous persistent Supabase session so this change takes
    // effect immediately for users who were already signed in.
    window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
  }

  return window.sessionStorage;
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: getSessionStorage(),
        storageKey: AUTH_STORAGE_KEY,
      },
    })
  : null;
