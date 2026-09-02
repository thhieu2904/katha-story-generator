'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { KathaLoadingScreen } from '@/components/feedback/KathaLoading';
import { useUiCopy } from '@/features/language/useUiCopy';
import { useAuth } from './useAuth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useUiCopy();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  const hasVerifiedUser = user !== null;

  if ((status === 'loading' && !hasVerifiedUser) || status === 'unauthenticated') {
    return <KathaLoadingScreen label={copy.verifyingSession} />;
  }

  if (!hasVerifiedUser) {
    return <KathaLoadingScreen label={copy.verifyingSession} />;
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
