'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { KathaLogo } from './KathaLogo';
import { ThemeToggle } from './ThemeToggle';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { getUiCopy } from '@/features/language/uiCopy';

const NAV_ITEMS = [
  { href: '/admin/vision', labelKey: 'navLearn', hintKey: 'navLearnHint' },
  { href: '/admin/characters', labelKey: 'navCharacters', hintKey: 'navCharactersHint' },
  { href: '/admin/stories', labelKey: 'navStories', hintKey: 'navStoriesHint' },
  { href: '/admin/dictionary', labelKey: 'navDictionary', hintKey: 'navDictionaryHint' },
  { href: '/admin/museum', labelKey: 'navMuseum', hintKey: 'navMuseumHint', beta: true },
  { href: '/admin/accounts', labelKey: 'navAccounts', hintKey: 'navAccountsHint', adminOnly: true },
] as const;

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useContentLanguage();
  const copy = getUiCopy(language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !('adminOnly' in item) || !item.adminOnly || user?.app_role === 'admin',
  );

  const activeItem = visibleNavItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== '/admin/vision' && pathname.startsWith(`${item.href}/`)),
  );

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="katha-admin-header sticky top-0 z-40 border-b border-katha-text/10 bg-katha-surface/85 backdrop-blur-xl">
      <div className="katha-mobile-header mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-3 lg:hidden">
        <Link
          href="/admin/vision"
          aria-label="Katha"
          onClick={() => setMobileMenuOpen(false)}
          className="flex min-w-0 items-center gap-2 font-bold"
        >
          <KathaLogo height={42} priority className="-my-1.5" />
          <span className="truncate text-sm text-katha-text/70">
            {activeItem ? copy[activeItem.labelKey] : 'Katha'}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="katha-mobile-navigation"
            aria-label={mobileMenuOpen ? copy.closeNavigation : copy.openNavigation}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="katha-mobile-menu-toggle"
          >
            <span className="katha-mobile-menu-toggle__mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{copy.contents}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={mobileMenuOpen ? 'rotate-180' : ''}
            >
              <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      </div>

      <>
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          disabled={!mobileMenuOpen}
          data-open={mobileMenuOpen}
          className="katha-mobile-menu-backdrop lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          id="katha-mobile-navigation"
          aria-hidden={!mobileMenuOpen}
          data-open={mobileMenuOpen}
          className="katha-mobile-menu-sheet lg:hidden"
        >
            <div className="katha-mobile-menu-binding" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="katha-mobile-menu-heading">
              <div>
                <p>{copy.kathaNotebook}</p>
                <strong>{copy.contents}</strong>
              </div>
              <span>
                {activeItem
                  ? String(visibleNavItems.findIndex((item) => item === activeItem) + 1).padStart(2, '0')
                  : 'K'}
              </span>
            </div>
            <nav aria-label={copy.adminNavigation} className="katha-mobile-menu-list">
              {visibleNavItems.map((item, index) => {
                const isActive = item === activeItem;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    tabIndex={mobileMenuOpen ? undefined : -1}
                    onClick={() => setMobileMenuOpen(false)}
                    className="katha-mobile-menu-link"
                  >
                    <span className="katha-mobile-menu-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <strong>{copy[item.labelKey]}</strong>
                      <small>{copy[item.hintKey]}</small>
                    </span>
                    {'beta' in item && item.beta ? <em>Beta</em> : null}
                    <svg aria-hidden="true" viewBox="0 0 20 20">
                      <path d="m7.5 5 5 5-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </Link>
                );
              })}
            </nav>
            <div className="katha-mobile-menu-account">
              <span className="min-w-0 truncate">{user?.email}</span>
              <button
                type="button"
                tabIndex={mobileMenuOpen ? undefined : -1}
                onClick={() => void handleSignOut()}
              >
                {copy.signOut}
              </button>
            </div>
          </div>
      </>

      <div className="mx-auto hidden min-h-16 max-w-7xl items-center justify-between gap-2 px-5 lg:flex lg:gap-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 lg:gap-7">
          <Link href="/admin/vision" className="flex shrink-0 items-center gap-3 font-bold">
            <KathaLogo height={48} priority className="-my-2" />
            <span className="hidden xl:inline">Katha</span>
          </Link>
          <nav aria-label={copy.adminNavigation} className="flex items-center">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/vision' && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`katha-nav-link relative rounded-lg px-3 py-2 text-sm transition duration-200 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-katha-gold after:transition-transform after:duration-300 active:scale-90 active:bg-katha-gold/25 active:text-katha-gold active:shadow-lg active:shadow-katha-gold/20 xl:px-4 ${
                    isActive
                      ? 'bg-katha-primary/10 font-semibold text-katha-text shadow-sm shadow-katha-primary/10 after:scale-x-100'
                      : 'font-medium text-katha-text/65 after:scale-x-0 hover:bg-katha-text/[0.06] hover:text-katha-text'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {copy[item.labelKey]}
                    {'beta' in item && item.beta ? (
                      <span className="rounded-full border border-katha-gold/30 bg-katha-gold/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-katha-gold sm:text-[9px]">
                        Beta
                      </span>
                    ) : null}
                  </span>
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
            {copy.signOut}
          </button>
        </div>
      </div>
    </header>
  );
}
