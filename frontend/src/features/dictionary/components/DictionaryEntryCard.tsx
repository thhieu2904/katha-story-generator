'use client';

import { useEffect, useRef } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import type { DictionaryEntry } from '../types';

export type DictionaryVoiceStatus = 'idle' | 'loading' | 'playing' | 'error';
const DICTIONARY_PLAYBACK_RATES = [0.7, 0.8, 1] as const;

interface VoiceButtonProps {
  entry: DictionaryEntry;
  status: DictionaryVoiceStatus;
  onToggle: (entry: DictionaryEntry) => void;
  expanded?: boolean;
}

function VoiceButton({ entry, status, onToggle, expanded = false }: VoiceButtonProps) {
  const { copy } = useUiCopy();
  const label = status === 'playing'
    ? copy.pause
    : status === 'loading'
      ? copy.dictionaryVoiceLoading
      : copy.listenPronunciation;

  return (
    <button
      type="button"
      onClick={() => onToggle(entry)}
      aria-busy={status === 'loading'}
      aria-label={status === 'playing' ? copy.pause : formatCopy(copy.listenToWord, { word: entry.khmer })}
      className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold focus-visible:ring-offset-2 focus-visible:ring-offset-katha-surface ${
        expanded ? 'min-h-11 px-5 text-sm' : 'min-h-9 min-w-9 px-2 text-xs'
      } ${
        status === 'playing'
          ? 'border-katha-gold/45 bg-katha-gold/15 text-katha-gold shadow-lg shadow-katha-gold/10'
          : status === 'error'
            ? 'border-katha-error/35 bg-katha-error/10 text-red-200'
            : 'border-katha-primary/25 bg-katha-primary/10 text-katha-primary-light hover:border-katha-gold/40 hover:bg-katha-gold/10 hover:text-katha-gold'
      }`}
    >
      {status === 'loading' ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
      ) : status === 'playing' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
          <path d="M15 9.5a4 4 0 0 1 0 5M17.8 7a7.5 7.5 0 0 1 0 10" strokeLinecap="round" />
        </svg>
      )}
      {expanded ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </button>
  );
}

export function DictionaryEntryCard({
  entry,
  source,
  voiceStatus,
  onOpen,
  onVoice,
  animationDelayMs = 0,
}: {
  entry: DictionaryEntry;
  source: string;
  voiceStatus: DictionaryVoiceStatus;
  onOpen: (entry: DictionaryEntry) => void;
  onVoice: (entry: DictionaryEntry) => void;
  animationDelayMs?: number;
}) {
  const { copy } = useUiCopy();

  return (
    <article
      className="katha-card katha-dictionary-card-enter group relative isolate overflow-hidden rounded-xl border border-katha-text/10 bg-gradient-to-br from-katha-text/[0.055] to-katha-field p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-katha-gold/40 hover:shadow-xl hover:shadow-katha-primary/10 focus-within:-translate-y-0.5 focus-within:border-katha-gold/45 focus-within:shadow-xl focus-within:shadow-katha-primary/10"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-katha-primary/0 blur-2xl transition duration-500 group-hover:bg-katha-primary/20 group-focus-within:bg-katha-primary/20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-katha-gold/0 to-transparent transition duration-300 group-hover:via-katha-gold/70 group-focus-within:via-katha-gold/70" />
      <button
        type="button"
        onClick={() => onOpen(entry)}
        aria-label={formatCopy(copy.dictionaryOpenEntry, { word: entry.khmer })}
        className="absolute inset-0 z-[1] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-katha-gold"
      />

      <div className="pointer-events-none relative z-[2]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 lang="km" className="line-clamp-1 font-khmer text-lg font-semibold leading-relaxed text-katha-text transition duration-300 group-hover:text-katha-gold group-focus-within:text-katha-gold">
              {entry.khmer}
            </h2>
            <p className="truncate text-xs font-medium tracking-wide text-katha-primary-light/85">
              {entry.transliteration}
            </p>
          </div>
          <div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1.5">
            <span className="rounded-full border border-katha-text/10 bg-katha-surface/40 px-2 py-0.5 text-[10px] font-semibold text-katha-text/45 backdrop-blur">
              #{entry.id}
            </span>
            <VoiceButton entry={entry} status={voiceStatus} onToggle={onVoice} />
          </div>
        </div>

        <div className="my-1.5 h-px bg-gradient-to-r from-katha-text/15 to-transparent" />
        <p className="line-clamp-1 text-[13px] leading-5 text-katha-text/80">
          {entry.vietnamese}
        </p>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-katha-text/38">{copy.source}: {source}</span>
          <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold text-katha-gold/70 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-within:translate-x-0.5 group-focus-within:opacity-100 xl:inline-flex">
            {copy.dictionaryTapForDetails}
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function DictionaryEntryDialog({
  entry,
  source,
  voiceStatus,
  playbackRate,
  onClose,
  onVoice,
  onPlaybackRateChange,
}: {
  entry: DictionaryEntry;
  source: string;
  voiceStatus: DictionaryVoiceStatus;
  playbackRate: number;
  onClose: () => void;
  onVoice: (entry: DictionaryEntry) => void;
  onPlaybackRateChange: (rate: number) => void;
}) {
  const { copy } = useUiCopy();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="katha-dictionary-dialog-backdrop fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dictionary-entry-title"
        className="katha-card katha-dictionary-dialog-enter relative w-full max-w-lg overflow-hidden rounded-2xl border border-katha-gold/30 bg-katha-surface p-4 shadow-2xl shadow-black/40 sm:p-5"
      >
        <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-katha-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-katha-gold/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-katha-primary-light">
              {copy.dictionaryEntryDetails}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={copy.dictionaryCloseDetails}
              className="grid h-10 w-10 place-items-center rounded-full border border-katha-text/10 bg-katha-text/[0.04] text-lg text-katha-text/65 transition hover:border-katha-gold/35 hover:bg-katha-gold/10 hover:text-katha-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold"
            >
              ×
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-katha-primary/20 bg-gradient-to-br from-katha-primary/12 to-katha-text/[0.025] p-4 text-center sm:p-5">
            <h2
              id="dictionary-entry-title"
              lang="km"
              className="max-w-full break-words font-khmer text-2xl font-semibold leading-relaxed text-katha-text [overflow-wrap:anywhere] sm:text-4xl"
            >
              {entry.khmer}
            </h2>
            <p className="mt-1.5 max-w-full break-words text-sm font-semibold text-katha-primary-light [overflow-wrap:anywhere] sm:text-base sm:tracking-wide">
              {entry.transliteration}
            </p>
            {!entry.transliteration_reviewed ? (
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-katha-text/40">
                {copy.dictionaryAutomaticTransliteration}
              </p>
            ) : null}
            <div className="mt-4 flex justify-center">
              <VoiceButton entry={entry} status={voiceStatus} onToggle={onVoice} expanded />
            </div>
            <div className="mx-auto mt-3 flex max-w-sm flex-col items-center gap-2">
              <p className="text-xs font-semibold text-katha-text/45">
                {copy.pronunciationSpeed}
              </p>
              <div
                role="group"
                aria-label={copy.pronunciationSpeed}
                className="inline-flex rounded-xl border border-katha-text/10 bg-katha-field p-1"
              >
                {DICTIONARY_PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    aria-label={formatCopy(copy.speedTimes, { rate })}
                    aria-pressed={playbackRate === rate}
                    onClick={() => onPlaybackRateChange(rate)}
                    className={`min-h-9 min-w-16 rounded-lg px-3 text-xs font-bold transition ${
                      playbackRate === rate
                        ? 'bg-katha-primary text-katha-text shadow-sm'
                        : 'text-katha-text/50 hover:bg-katha-text/[0.06] hover:text-katha-text'
                    }`}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            </div>
            {voiceStatus === 'error' ? (
              <p role="alert" className="mt-3 text-sm text-red-200">
                {copy.dictionaryVoiceUnavailable}
              </p>
            ) : null}
          </div>

          <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-katha-text/10 bg-katha-text/[0.035] p-3.5 sm:col-span-2">
              <dt className="text-xs font-bold uppercase tracking-wider text-katha-text/40">
                {copy.dictionaryMeaning}
              </dt>
              <dd className="mt-1.5 break-words text-base leading-7 text-katha-text/85 [overflow-wrap:anywhere]">
                {entry.vietnamese}
              </dd>
            </div>
            <div className="rounded-xl border border-katha-text/10 bg-katha-text/[0.035] p-3.5">
              <dt className="text-xs text-katha-text/40">{copy.source}</dt>
              <dd className="mt-1 font-semibold text-katha-text/75">{source}</dd>
            </div>
            <div className="rounded-xl border border-katha-text/10 bg-katha-text/[0.035] p-3.5">
              <dt className="text-xs text-katha-text/40">{copy.dictionaryEntryNumber}</dt>
              <dd className="mt-1 font-semibold text-katha-text/75">#{entry.id}</dd>
            </div>
            {entry.page ? (
              <div className="rounded-xl border border-katha-text/10 bg-katha-text/[0.035] p-3.5">
                <dt className="text-xs text-katha-text/40">{copy.dictionarySourcePage}</dt>
                <dd className="mt-1 font-semibold text-katha-text/75">{entry.page}</dd>
              </div>
            ) : null}
            {entry.quality ? (
              <div className="rounded-xl border border-katha-text/10 bg-katha-text/[0.035] p-3.5">
                <dt className="text-xs text-katha-text/40">{copy.dictionaryQuality}</dt>
                <dd className="mt-1 font-semibold text-katha-text/75">{entry.quality}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>
    </div>
  );
}
