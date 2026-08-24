'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { KathaLogo } from '@/components/layout/KathaLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

function requestedAdminPath() {
  if (typeof window === 'undefined') return '/admin/characters';
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/admin/') ? next : '/admin/characters';
}

export default function LoginPage() {
  const { status, user, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user?.app_role === 'admin') {
      router.replace(requestedAdminPath());
    }
  }, [router, status, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setSubmitting(true);
    try {
      const verifiedUser = await signIn(email.trim(), password);
      if (verifiedUser.app_role !== 'admin') {
        router.replace('/admin/characters');
        return;
      }
      router.replace(requestedAdminPath());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập không thành công.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="katha-page-shell relative grid min-h-screen place-items-center overflow-hidden bg-katha-surface px-5 py-10">
      <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-katha-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -right-24 h-96 w-96 rounded-full bg-katha-accent/15 blur-3xl" />

      <section className="katha-ornament-card relative w-full max-w-md rounded-[2rem] border border-katha-gold/25 bg-katha-surface-light/90 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="mb-8 text-center">
          <KathaLogo width={224} priority className="mx-auto mb-1" />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-katha-primary-light">
            Trang quản trị
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Chào mừng trở lại</h1>
          <p className="mt-2 text-sm leading-6 text-katha-text/50">
            Đăng nhập bằng tài khoản quản trị đã được cấp.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-katha-text/75">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              disabled={submitting}
              className="w-full rounded-xl border border-katha-text/10 bg-katha-field px-4 py-3 text-sm outline-none transition placeholder:text-katha-text/25 focus:border-katha-primary focus:ring-3 focus:ring-katha-primary/15 disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-katha-text/75">Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              className="w-full rounded-xl border border-katha-text/10 bg-katha-field px-4 py-3 text-sm outline-none transition placeholder:text-katha-text/25 focus:border-katha-primary focus:ring-3 focus:ring-katha-primary/15 disabled:opacity-60"
            />
          </label>

          {error && (
            <div role="alert" className="rounded-xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-katha-primary px-4 py-3 text-sm font-bold text-katha-on-solid shadow-lg shadow-katha-primary/15 transition hover:bg-katha-primary-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-katha-on-solid/25 border-t-katha-on-solid" />
            )}
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  );
}
