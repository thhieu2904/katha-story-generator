'use client';

import { useUiCopy } from '@/features/language/useUiCopy';
import { KhmerHistoryTreePrototype } from './KhmerHistoryTreePrototype';

const THINGLINK_SCENE_URL = 'https://www.thinglink.com/view/scene/2149874779585250148';
const THINGLINK_ACCESSIBLE_URL = `${THINGLINK_SCENE_URL}/accessibility`;

export function MuseumPage() {
  const { copy } = useUiCopy();

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-clip py-8 lg:py-10">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-katha-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-64 h-72 w-72 rounded-full bg-katha-gold/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 text-center sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-katha-gold/30 bg-katha-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-katha-gold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-katha-gold" aria-hidden="true" />
            Beta
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-katha-primary-light">
            {copy.museumEyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-katha-text sm:text-4xl">
            {copy.museumTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-katha-text/60 sm:text-base">
            {copy.museumSubtitle}
          </p>
        </header>

        <section className="katha-card overflow-hidden rounded-2xl border border-katha-text/10 bg-katha-field shadow-2xl shadow-black/20 sm:rounded-3xl">
          <div className="relative aspect-[2560/1489] min-h-[420px] w-full bg-black sm:min-h-[520px]">
            <iframe
              src={THINGLINK_SCENE_URL}
              title={copy.museumSceneTitle}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-katha-text/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-5 text-katha-text/45 sm:text-sm">
              {copy.museumBetaNotice}
            </p>
            <a
              href={THINGLINK_ACCESSIBLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-katha-primary/25 bg-katha-primary/10 px-4 text-xs font-semibold text-katha-primary-light transition hover:bg-katha-primary/20 sm:text-sm"
            >
              {copy.museumAccessibleVersion}
              <span className="ml-1.5" aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </div>

      <KhmerHistoryTreePrototype />
    </main>
  );
}
