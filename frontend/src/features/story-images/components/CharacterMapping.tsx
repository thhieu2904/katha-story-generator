'use client';

import Image from 'next/image';
import { useState } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import type { StoryImageCharacter } from '../types';

function CharacterThumbnail({ character }: { character: StoryImageCharacter }) {
  const [failed, setFailed] = useState(false);
  const src = character.thumbnail_url?.trim();
  const { copy } = useUiCopy();

  if (!src || failed) {
    return (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-katha-text/[0.07] text-katha-text/35">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-4.1 3.1-6.2 7-6.2s6.3 2.1 7 6.2" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-katha-text/[0.07]">
      <Image
        src={src}
        alt={formatCopy(copy.characterReference, { name: character.name })}
        fill
        unoptimized
        sizes="40px"
        onError={() => setFailed(true)}
        className="object-cover"
      />
    </div>
  );
}

interface CharacterMappingProps {
  pageNo: number;
  characters: StoryImageCharacter[];
  selectedCharacterIds: number[];
  disabled: boolean;
  onChange: (characterIds: number[]) => void;
}

export function CharacterMapping({
  pageNo,
  characters,
  selectedCharacterIds,
  disabled,
  onChange,
}: CharacterMappingProps) {
  const { copy } = useUiCopy();
  const selected = new Set(selectedCharacterIds);
  const selectionAtLimit = selected.size >= 3;
  const descriptionId = `page-${pageNo}-character-help`;

  return (
    <fieldset disabled={disabled} className="mt-5 rounded-xl border border-katha-text/10 bg-black/15 p-4 disabled:opacity-65">
      <legend className="px-1 text-sm font-semibold text-katha-text/85">{copy.charactersAppearing}</legend>
      <p id={descriptionId} className="mt-1 text-xs leading-5 text-katha-text/45">
        {copy.characterMappingHelp}
      </p>

      {characters.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-katha-text/15 px-3 py-2 text-xs text-katha-text/45">
          {copy.noStoryCharacters}
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {characters.map((character) => {
            const checked = selected.has(character.id);
            const optionDisabled = disabled || (!checked && selectionAtLimit);
            return (
              <label
                key={character.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition ${
                  checked
                    ? 'border-katha-primary/55 bg-katha-primary/10'
                    : 'border-katha-text/10 bg-katha-text/[0.025] hover:border-katha-text/20'
                } ${optionDisabled ? 'cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={optionDisabled}
                  aria-describedby={descriptionId}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...selectedCharacterIds, character.id]);
                      return;
                    }
                    onChange(selectedCharacterIds.filter((id) => id !== character.id));
                  }}
                  className="h-4 w-4 rounded border-katha-text/30 bg-katha-field text-katha-primary focus:ring-katha-primary"
                />
                <CharacterThumbnail character={character} />
                <span className="min-w-0 truncate text-sm font-medium text-katha-text/85">{character.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
