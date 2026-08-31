'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import { fetchDictionary, fetchDictionaryAudio } from '../api';
import type { DictionaryEntry, DictionarySearchResponse } from '../types';
import {
  DictionaryEntryCard,
  DictionaryEntryDialog,
  type DictionaryVoiceStatus,
} from './DictionaryEntryCard';

const PAGE_SIZE = 24;
const SOURCE_NAME = 'Kiêm Hạnh';
const DICTIONARY_DEFAULT_PLAYBACK_RATE = 0.8;
const GENERIC_LOAD_ERROR = 'DICTIONARY_LOAD_FAILED';

export function DictionaryPage() {
  const { copy, language } = useUiCopy();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DictionarySearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null);
  const [voice, setVoice] = useState<{ entryId: number | null; status: DictionaryVoiceStatus }>({
    entryId: null,
    status: 'idle',
  });
  const [playbackRate, setPlaybackRate] = useState(DICTIONARY_DEFAULT_PLAYBACK_RATE);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlsRef = useRef(new Map<number, string>());
  const audioRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = input.trim();
      if (nextQuery === query) return;
      setLoading(true);
      setError(null);
      setPage(1);
      setQuery(nextQuery);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, query]);

  useEffect(() => {
    const controller = new AbortController();

    void fetchDictionary({ query, page, pageSize: PAGE_SIZE, signal: controller.signal })
      .then(setData)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : GENERIC_LOAD_ERROR);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, query, retryCount]);

  useEffect(() => {
    const audioUrls = audioUrlsRef.current;
    const audio = audioRef.current;
    return () => {
      audioRequestRef.current?.abort();
      audio?.pause();
      audioUrls.forEach((url) => URL.revokeObjectURL(url));
      audioUrls.clear();
    };
  }, []);

  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 0;
  const source = data?.source ?? SOURCE_NAME;

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const closeEntry = useCallback(() => setSelectedEntry(null), []);

  const toggleVoice = useCallback(async (entry: DictionaryEntry) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (voice.entryId === entry.id && voice.status === 'playing') {
      audio.pause();
      setVoice({ entryId: entry.id, status: 'idle' });
      return;
    }
    if (voice.entryId === entry.id && voice.status === 'loading') {
      audioRequestRef.current?.abort();
      setVoice({ entryId: entry.id, status: 'idle' });
      return;
    }

    audioRequestRef.current?.abort();
    audio.pause();
    audio.currentTime = 0;
    const controller = new AbortController();
    audioRequestRef.current = controller;
    setVoice({ entryId: entry.id, status: 'loading' });

    try {
      let audioUrl = audioUrlsRef.current.get(entry.id);
      if (!audioUrl) {
        const blob = await fetchDictionaryAudio(entry.id, controller.signal);
        if (controller.signal.aborted) return;
        audioUrl = URL.createObjectURL(blob);
        audioUrlsRef.current.set(entry.id, audioUrl);
      }
      if (controller.signal.aborted) return;
      audio.src = audioUrl;
      audio.defaultPlaybackRate = playbackRate;
      audio.playbackRate = playbackRate;
      audio.preservesPitch = true;
      audio.load();
      await audio.play();
      if (!controller.signal.aborted) setVoice({ entryId: entry.id, status: 'playing' });
    } catch (reason) {
      if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        return;
      }
      setVoice({ entryId: entry.id, status: 'error' });
    }
  }, [playbackRate, voice]);

  const changePlaybackRate = useCallback((nextRate: number) => {
    setPlaybackRate(nextRate);
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = nextRate;
    audio.playbackRate = nextRate;
    audio.preservesPitch = true;
  }, []);

  return (
    <div className="min-h-screen">
      <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-katha-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-80 h-80 w-80 rounded-full bg-katha-gold/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <section className="katha-dictionary-reveal text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-katha-primary-light">
            {copy.dictionaryEyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-katha-text sm:text-4xl">
            {copy.dictionaryTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-katha-text/60 sm:text-base">
            {copy.dictionarySubtitle}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-katha-gold/25 bg-katha-gold/10 px-4 py-2 text-sm text-katha-text/70">
            <span className="h-2 w-2 rounded-full bg-katha-gold" aria-hidden="true" />
            {copy.source}:{' '}
            <strong className="font-semibold text-katha-text">{source}</strong>
          </div>
          </section>

        <section
          className="katha-dictionary-reveal mx-auto mt-8 max-w-2xl"
          data-delay="1"
          aria-label={copy.dictionarySearch}
        >
          <label htmlFor="dictionary-search" className="sr-only">
            {copy.dictionarySearchLabel}
          </label>
          <div className="katha-card flex items-center gap-3 rounded-2xl border border-katha-text/10 bg-katha-field p-2 shadow-xl shadow-katha-primary/5">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ml-3 shrink-0 text-katha-text/40"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="dictionary-search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.dictionaryPlaceholder}
              autoComplete="off"
              className="min-h-12 min-w-0 flex-1 bg-transparent px-1 text-base text-katha-text outline-none placeholder:text-katha-text/35"
            />
            {input ? (
              <button
                type="button"
                onClick={() => setInput('')}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-katha-text/55 transition hover:bg-katha-text/[0.06] hover:text-katha-text"
              >
                {copy.clear}
              </button>
            ) : null}
          </div>
        </section>

        <section className="katha-dictionary-reveal mt-8" data-delay="2" aria-busy={loading}>
          <div className="mb-5 flex min-h-7 items-center justify-between gap-4">
            <p className="text-sm font-semibold text-katha-text/65" aria-live="polite">
              {loading && !data
                ? copy.dictionaryLoading
                : query
                  ? formatCopy(copy.dictionaryResults, {
                      total: total.toLocaleString(language === 'km' ? 'km-KH' : 'vi-VN'),
                      query,
                    })
                  : formatCopy(copy.dictionaryEntries, {
                      total: total.toLocaleString(language === 'km' ? 'km-KH' : 'vi-VN'),
                    })}
            </p>
            {loading && data ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-katha-text/15 border-t-katha-primary" />
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-katha-error/25 bg-katha-error/10 p-6 text-center">
              <p className="font-semibold text-katha-text">{copy.dictionaryUnavailable}</p>
              <p className="mt-2 text-sm text-katha-text/60">
                {language === 'vi' && error !== GENERIC_LOAD_ERROR
                  ? error
                  : copy.dictionaryLoadFailed}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setRetryCount((count) => count + 1);
                }}
                className="mt-4 rounded-xl bg-katha-primary px-4 py-2 text-sm font-bold text-katha-text"
              >
                {copy.retry}
              </button>
            </div>
          ) : null}

          {!error && loading && !data ? (
            <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-xl border border-katha-text/10 bg-katha-text/[0.04]"
                />
              ))}
            </div>
          ) : null}

          {!error && !loading && data?.items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-katha-text/15 bg-katha-text/[0.025] px-6 py-16 text-center">
              <p className="text-lg font-semibold text-katha-text">{copy.dictionaryNotFound}</p>
              <p className="mt-2 text-sm text-katha-text/55">
                {copy.dictionaryNotFoundHelp}
              </p>
            </div>
          ) : null}

          {!error && data?.items.length ? (
            <div key={`${query}-${page}`} className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {data.items.map((entry, index) => (
                <DictionaryEntryCard
                  key={entry.id}
                  entry={entry}
                  source={source}
                  voiceStatus={voice.entryId === entry.id ? voice.status : 'idle'}
                  onOpen={setSelectedEntry}
                  onVoice={(nextEntry) => void toggleVoice(nextEntry)}
                  animationDelayMs={Math.min(index, 10) * 55}
                />
              ))}
            </div>
          ) : null}

          {!error && totalPages > 1 ? (
            <nav
              className="mt-9 flex items-center justify-center gap-3"
              aria-label={copy.dictionaryPagination}
            >
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => changePage(page - 1)}
                className="rounded-xl border border-katha-text/10 px-4 py-2.5 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.06] disabled:opacity-40"
              >
                {copy.previous}
              </button>
              <span className="min-w-28 text-center text-sm text-katha-text/60">
                {formatCopy(copy.pageNumber, { page, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => changePage(page + 1)}
                className="rounded-xl border border-katha-text/10 px-4 py-2.5 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.06] disabled:opacity-40"
              >
                {copy.next}
              </button>
            </nav>
          ) : null}
        </section>

        <footer className="mt-14 border-t border-katha-text/10 pt-6 text-center text-xs leading-5 text-katha-text/40">
          {formatCopy(copy.dictionaryCredit, { source })}
        </footer>
        </div>
      </main>

      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        aria-label={copy.dictionaryAudioPlayer}
        onEnded={() => setVoice((current) => ({ ...current, status: 'idle' }))}
        onError={() => setVoice((current) => ({ ...current, status: 'error' }))}
      />

      {selectedEntry ? (
        <DictionaryEntryDialog
          entry={selectedEntry}
          source={source}
          voiceStatus={voice.entryId === selectedEntry.id ? voice.status : 'idle'}
          playbackRate={playbackRate}
          onClose={closeEntry}
          onVoice={(entry) => void toggleVoice(entry)}
          onPlaybackRateChange={changePlaybackRate}
        />
      ) : null}
    </div>
  );
}
