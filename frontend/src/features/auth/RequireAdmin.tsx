'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { useUiCopy } from '@/features/language/useUiCopy';
import { KathaLoadingScreen } from '@/components/feedback/KathaLoading';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useUiCopy();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  const hasVerifiedAdmin = user?.app_role === 'admin';

  if ((status === 'loading' && !hasVerifiedAdmin) || status === 'unauthenticated') {
    return <KathaLoadingScreen label={copy.verifyingSession} />;
  }

  if (!hasVerifiedAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-katha-surface px-5">
        <section className="w-full max-w-md rounded-3xl border border-katha-text/10 bg-katha-text/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-katha-warning/15 text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-semibold">{copy.adminRequiredTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-katha-text/55">
            {copy.adminRequiredBody}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-xl bg-katha-text px-5 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-katha-text/90"
          >
            {copy.signOut}
          </button>
        </section>
      </main>
    );
  }

  const isRevalidating = status === 'loading';

  return (
    <>
      <div
        className={isRevalidating ? 'invisible pointer-events-none' : undefined}
        aria-hidden={isRevalidating || undefined}
      >
        {children}
      </div>
      {isRevalidating && (
        <KathaLoadingScreen
          label={copy.verifyingSession}
          className="fixed inset-0 z-50"
        />
      )}
    </>
  );
}
