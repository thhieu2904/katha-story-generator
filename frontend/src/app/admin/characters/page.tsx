'use client';

import { CharacterCard } from '@/features/characters/components/CharacterCard';
import { useCharacters } from '@/features/characters/useCharacters';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

function CharacterSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-katha-text/8 bg-katha-text/[0.025]">
      <div className="aspect-[4/3] animate-pulse bg-katha-text/[0.055]" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/5 animate-pulse rounded bg-katha-text/[0.07]" />
        <div className="h-4 w-full animate-pulse rounded bg-katha-text/[0.05]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-katha-text/[0.05]" />
      </div>
    </div>
  );
}

export default function CharactersPage() {
  const { characters, error, loading, retry } = useCharacters();
  const { copy, language } = useUiCopy();

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="katha-eyebrow text-xs font-semibold uppercase tracking-[0.22em] text-katha-primary-light">
            {copy.characterBankEyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {copy.characterBankTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-katha-text/50">
            {copy.characterBankSubtitle}
          </p>
        </div>
        {characters && (
          <span className="w-fit rounded-full border border-katha-text/10 bg-katha-text/[0.04] px-3 py-1.5 text-xs text-katha-text/55">
            {formatCopy(copy.characterCount, { count: characters.length })}
          </span>
        )}
      </div>

      {loading && (
        <div
          aria-label={copy.loadingCharacters}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {Array.from({ length: 7 }, (_, index) => (
            <CharacterSkeleton key={index} />
          ))}
        </div>
      )}

      {error && (
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
          <h2 className="font-semibold text-red-100">{copy.charactersUnavailable}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-katha-text/50">
            {language === 'vi' ? error : copy.charactersUnavailable}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 rounded-xl bg-katha-text px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-katha-text/90"
          >
            {copy.retry}
          </button>
        </section>
      )}

      {characters?.length === 0 && (
        <section className="rounded-2xl border border-dashed border-katha-text/15 px-6 py-14 text-center">
          <div className="text-3xl">✦</div>
          <h2 className="mt-3 font-semibold">{copy.noCharactersYet}</h2>
          <p className="mt-2 text-sm text-katha-text/45">
            {copy.noCharactersSeedHelp}
          </p>
        </section>
      )}

      {characters && characters.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {characters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}
    </main>
  );
}
