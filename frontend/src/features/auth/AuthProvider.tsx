'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { AuthContext, type AuthStatus, type AuthUser } from './auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const validationId = useRef(0);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const requestId = ++validationId.current;
    setSession(nextSession);

    if (!nextSession) {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }

    setStatus('loading');
    try {
      const verifiedUser = await apiFetch<AuthUser>('/api/auth/me', {
        accessToken: nextSession.access_token,
      });
      if (requestId === validationId.current) {
        setUser(verifiedUser);
        setStatus('authenticated');
      }
      return verifiedUser;
    } catch {
      if (requestId === validationId.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      const frame = requestAnimationFrame(() => {
        setStatus('unauthenticated');
      });
      return () => cancelAnimationFrame(frame);
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        void applySession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (active) {
          void applySession(nextSession);
        }
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error('Supabase Auth chưa được cấu hình.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error('Email hoặc mật khẩu không đúng.');
      }

      const verifiedUser = await applySession(data.session);
      if (!verifiedUser) {
        throw new Error('Không thể xác minh phiên đăng nhập với máy chủ.');
      }
      return verifiedUser;
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    validationId.current += 1;
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ status, session, user, signIn, signOut }),
    [session, signIn, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
