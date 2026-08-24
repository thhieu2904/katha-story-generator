'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { KathaLogo } from './KathaLogo';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { href: '/admin/vision', label: 'Chính' },
  { href: '/admin/characters', label: 'Nhân vật' },
  { href: '/admin/stories', label: 'Truyện' },
] as const;

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="katha-admin-header sticky top-0 z-20 overflow-x-clip border-b border-katha-text/10 bg-katha-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:flex-nowrap sm:px-5 sm:py-0 lg:gap-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-7">
          <Link href="/admin/vision" className="flex shrink-0 items-center gap-2.5 font-bold">
            <KathaLogo height={48} priority className="-my-2" />
            <span className="hidden xl:inline">Katha</span>
          </Link>
          <nav aria-label="Quản trị" className="flex items-center">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/vision' && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`katha-nav-link relative rounded-lg px-2 py-2 text-xs transition duration-200 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-katha-gold after:transition-transform after:duration-300 active:scale-90 active:bg-katha-gold/25 active:text-katha-gold active:shadow-lg active:shadow-katha-gold/20 sm:px-3 sm:text-sm lg:px-6 ${
                    isActive
                      ? 'bg-katha-primary/10 font-semibold text-katha-text shadow-sm shadow-katha-primary/10 after:scale-x-100'
                      : 'font-medium text-katha-text/65 after:scale-x-0 hover:bg-katha-text/[0.06] hover:text-katha-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex min-w-0 items-center gap-2 lg:gap-3">
          <ThemeToggle />
          <span className="hidden max-w-52 truncate text-sm text-katha-text/45 xl:block">
            {user?.email}
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="shrink-0 rounded-lg border border-katha-text/10 px-2.5 py-2 text-xs text-katha-text/70 transition hover:border-katha-text/20 hover:bg-katha-text/[0.06] hover:text-katha-text sm:px-3 sm:text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
