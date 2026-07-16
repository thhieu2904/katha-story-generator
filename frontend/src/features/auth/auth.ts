import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'reader';

export interface AuthUser {
  id: string;
  email: string | null;
  app_role: AppRole;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
