'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { useUiCopy } from '@/features/language/useUiCopy';
import { KathaLoadingScreen } from '@/components/feedback/KathaLoading';

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();
  const { copy } = useUiCopy();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated') {
      router.replace('/admin/vision');
    }
  }, [router, status]);

  return <KathaLoadingScreen label={copy.openingKatha} />;
}
