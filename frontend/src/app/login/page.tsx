'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useUiCopy } from '@/features/language/useUiCopy';

function requestedAuthenticatedPath() {
  if (typeof window === 'undefined') return '/admin/vision';
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/admin/') ? next : '/admin/vision';
}

export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { copy } = useUiCopy();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(requestedAuthenticatedPath());
    }
  }, [router, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError(copy.fillCredentials);
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace(requestedAuthenticatedPath());
    } catch {
      setError(copy.loginFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="katha-login-page relative min-h-dvh overflow-hidden bg-katha-surface text-katha-text">
      <div className="katha-login-aurora pointer-events-none absolute -left-32 -top-40 size-[32rem] rounded-full bg-katha-gold/15 blur-3xl" />
      <div className="katha-login-aurora katha-login-aurora-delayed pointer-events-none absolute -bottom-48 -right-32 size-[36rem] rounded-full bg-katha-primary/20 blur-3xl" />
      <div className="absolute right-4 top-4 z-30 sm:right-7 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1380px] place-items-center px-3 py-[4.75rem] sm:px-7 sm:py-20 lg:px-10 lg:py-12">
        <section className="katha-login-panel grid w-full max-w-[1160px] overflow-hidden rounded-[1.5rem] border border-katha-gold/20 bg-katha-surface-light/88 shadow-2xl backdrop-blur-2xl sm:rounded-[2rem] lg:grid-cols-[1.06fr_0.94fr]">
          <aside className="katha-login-brand relative isolate flex min-h-[180px] flex-col justify-between overflow-hidden px-5 py-5 text-white sm:min-h-[300px] sm:px-9 sm:py-8 lg:min-h-[680px] lg:px-12 lg:py-11">
            <div className="katha-login-brand-grid pointer-events-none absolute inset-0 opacity-35" />
            <div className="katha-login-sparkles pointer-events-none absolute inset-0" aria-hidden="true">
              <span /><span /><span /><span /><span /><span />
            </div>

            <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
              <span className="grid size-8 place-items-center rounded-full border border-amber-200/30 bg-amber-200/10 text-amber-100 shadow-lg shadow-amber-300/10 sm:size-9">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
                  <circle cx="12" cy="12" r="3.5" />
                </svg>
              </span>
              <div>
                <strong className="block text-xs tracking-[0.18em] text-amber-100 sm:text-sm">KATHA</strong>
                <span lang="km" className="hidden font-khmer text-xs text-white/55 sm:block">កថា · Văn hóa Khmer</span>
              </div>
            </div>

            <div className="absolute right-2 top-1/2 z-10 w-[150px] -translate-y-1/2 sm:static sm:mx-auto sm:-my-4 sm:w-[260px] sm:translate-y-0 lg:w-[390px]">
              <div className="katha-login-halo pointer-events-none absolute inset-[9%] rounded-full border border-amber-200/30" />
              <div className="pointer-events-none absolute inset-[20%] rounded-full bg-amber-300/25 blur-3xl" />
              <Image
                src="/katha-logo.png"
                alt="Katha"
                width={760}
                height={633}
                priority
                sizes="(min-width: 1024px) 390px, (min-width: 640px) 260px, 150px"
                className="katha-login-logo relative h-auto w-full drop-shadow-[0_18px_34px_rgba(0,0,0,0.42)]"
              />
            </div>

            <div className="relative z-10 max-w-[13rem] sm:max-w-xl sm:text-center lg:text-left">
              <h2 className="text-base font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
                {copy.loginBrandTitle}
              </h2>
              <p className="mt-3 hidden text-sm leading-6 text-white/62 sm:block lg:max-w-lg">
                {copy.loginBrandSubtitle}
              </p>
            </div>
          </aside>

          <div className="katha-login-form-pane flex items-center bg-katha-surface-light/90 px-5 py-7 sm:px-10 sm:py-12 lg:px-14">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-6 sm:mb-8">
                <div className="katha-eyebrow text-xs font-bold uppercase tracking-[0.24em] text-katha-gold">
                  {copy.loginEyebrow}
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-katha-text sm:mt-4 sm:text-4xl">
                  {copy.loginTitle}
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-katha-text/52">
                  {copy.loginSubtitle}
                </p>
              </div>

              <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit} noValidate>
                <label className="group block">
                  <span className="mb-2 block text-sm font-semibold text-katha-text/72">{copy.email}</span>
                  <div className="relative">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-katha-text/28 transition group-focus-within:text-katha-gold" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="m5 8 7 5 7-5" />
                    </svg>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="email@example.com"
                      disabled={submitting}
                      className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 pl-12 pr-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:opacity-60"
                    />
                  </div>
                </label>

                <label className="group block">
                  <span className="mb-2 block text-sm font-semibold text-katha-text/72">{copy.password}</span>
                  <div className="relative">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-katha-text/28 transition group-focus-within:text-katha-gold" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <rect x="4" y="10" width="16" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                    </svg>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      disabled={submitting}
                      className="h-13 w-full rounded-2xl border border-katha-text/10 bg-katha-field/80 pl-12 pr-4 text-sm outline-none transition duration-200 placeholder:text-katha-text/24 hover:border-katha-text/20 focus:border-katha-gold/60 focus:bg-katha-field focus:ring-4 focus:ring-katha-gold/10 disabled:opacity-60"
                    />
                  </div>
                </label>

                {error && (
                  <div role="alert" className="katha-login-error flex items-start gap-3 rounded-2xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-red-200">
                    <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-katha-error/15 text-xs font-black">!</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="katha-login-submit group relative flex h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-katha-primary to-katha-primary-light px-5 text-sm font-black text-katha-on-solid shadow-xl shadow-katha-primary/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-katha-primary/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {submitting && (
                      <span className="size-4 animate-spin rounded-full border-2 border-katha-on-solid/25 border-t-katha-on-solid" />
                    )}
                    {submitting ? copy.signingIn : copy.signIn}
                    {!submitting && (
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 10h12M11 5l5 5-5 5" />
                      </svg>
                    )}
                  </span>
                </button>
              </form>

              <div className="mt-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-katha-text/30 sm:mt-8">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-katha-gold/30" />
                <span>Katha · កថា</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-katha-gold/30" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
