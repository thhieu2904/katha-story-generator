'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { KathaLogo } from './KathaLogo';

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-katha-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-7">
          <Link href="/admin/characters" className="flex items-center gap-2.5 font-bold">
            <KathaLogo height={48} priority className="-my-2" />
            <span className="hidden sm:inline">Katha</span>
          </Link>
          <nav aria-label="Quản trị" className="flex items-center gap-1">
            <Link
              href="/admin/characters"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Nhân vật
            </Link>
            <Link
              href="/admin/stories"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Truyện
            </Link>
          </nav>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden max-w-52 truncate text-sm text-white/45 sm:block">
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
