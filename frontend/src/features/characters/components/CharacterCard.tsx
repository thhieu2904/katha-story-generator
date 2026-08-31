'use client';

import Image from 'next/image';
import { useState } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import type { Character } from '../types';

function CharacterPlaceholder() {
  const { copy } = useUiCopy();

  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-katha-primary/15 to-katha-accent/10">
      <div className="text-center text-katha-text/35">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mx-auto h-10 w-10"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-4.1 3.1-6.2 7-6.2s6.3 2.1 7 6.2" />
        </svg>
        <span className="mt-2 block text-xs">{copy.noImage}</span>
      </div>
    </div>
  );
}

export function CharacterCard({ character }: { character: Character }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { copy } = useUiCopy();
  const imageUrl = character.ref_image_urls[0];

  return (
    <article className="katha-card group overflow-hidden rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] transition duration-300 hover:-translate-y-1 hover:border-katha-text/20 hover:bg-katha-text/[0.055] hover:shadow-2xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-katha-field">
        {imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt={formatCopy(copy.characterReferenceAlt, { name: character.name })}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setImageFailed(true)}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <CharacterPlaceholder />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
        {character.age !== null && (
          <span className="absolute bottom-3 right-3 rounded-full border border-katha-text/15 bg-black/45 px-2.5 py-1 text-xs font-medium text-katha-text/80 backdrop-blur">
            {formatCopy(copy.yearsOld, { age: character.age })}
          </span>
        )}
      </div>

      <div className="p-5">
        <h2 className="text-lg font-bold tracking-tight">{character.name}</h2>
        <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-katha-text/55">
          {character.personality_vi || copy.noPersonality}
        </p>
      </div>
    </article>
  );
}
