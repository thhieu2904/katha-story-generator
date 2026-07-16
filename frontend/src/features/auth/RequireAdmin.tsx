'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './useAuth';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <main className="grid min-h-screen place-items-center bg-katha-surface">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-katha-primary-light" />
          Đang xác minh phiên đăng nhập…
        </div>
      </main>
    );
  }

  if (user?.app_role !== 'admin') {
    return (
      <main className="grid min-h-screen place-items-center bg-katha-surface px-5">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-katha-warning/15 text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-semibold">Tài khoản không có quyền quản trị</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Bạn đã đăng nhập thành công nhưng tài khoản này chỉ có quyền đọc truyện.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-white/90"
          >
            Đăng xuất
          </button>
        </section>
      </main>
    );
  }

  return children;
}
