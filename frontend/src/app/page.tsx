'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { KathaLogo } from '@/components/layout/KathaLogo';

export default function HomePage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated') {
      router.replace(user?.app_role === 'admin' ? '/admin/vision' : '/login');
    }
  }, [router, status, user]);

  return (
    <main className="grid min-h-screen place-items-center bg-katha-surface">
      <div className="flex flex-col items-center gap-5">
        <KathaLogo width={260} priority />
        <div className="flex items-center gap-3 text-sm text-katha-text/60">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-katha-text/20 border-t-katha-primary-light" />
          Đang mở Katha…
        </div>
      </div>
    </main>
  );
}
