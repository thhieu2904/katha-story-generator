'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchKeywordAudio, type KhmerKnowledge } from '@/features/vision/api';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { formatCopy, getUiCopy } from '@/features/language/uiCopy';
import type { ContentLanguage } from '@/features/language/ContentLanguageProvider';
import { KathaLoadingIndicator } from '@/components/feedback/KathaLoading';
import type { KeywordLessonProgress } from '../visionLearningProgress';

interface KeywordLessonProps {
  className: string;
  knowledge: KhmerKnowledge;
  initialProgress?: KeywordLessonProgress;
  onProgressChange?: (progress: KeywordLessonProgress) => void;
  onBack: () => void;
  onContinueToStory: () => void;
  language?: ContentLanguage;
}

type AudioPreparationState = 'preparing' | 'ready' | 'error' | 'skipped';
type PlaybackRate = 0.5 | 0.75 | 1;

const PLAYBACK_RATES: PlaybackRate[] = [0.5, 0.75, 1];
const PLAYBACK_RATE_STORAGE_KEY = 'katha-keyword-playback-rate';

export function KeywordLesson({
  className,
  knowledge,
  initialProgress,
  onProgressChange,
  onBack,
  onContinueToStory,
  language,
}: KeywordLessonProps) {
  const { language: sharedContentLanguage } = useContentLanguage();
  const contentLanguage = language ?? sharedContentLanguage;
  const copy = getUiCopy(contentLanguage);
  const lastKeywordIndex = Math.max(knowledge.keywords.length - 1, 0);
  const initialIndex = Math.min(
    Math.max(initialProgress?.currentIndex ?? 0, 0),
    lastKeywordIndex,
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [completed, setCompleted] = useState(initialProgress?.completed ?? false);
  const [audioState, setAudioState] = useState<AudioPreparationState>(() =>
    knowledge.keywords.length === 0 ? 'ready' : 'preparing',
  );
  const [preparedCount, setPreparedCount] = useState(0);
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [heardKeywords, setHeardKeywords] = useState<Set<number>>(() => new Set());
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const keywords = knowledge.keywords;

  useEffect(() => {
    let savedRate: PlaybackRate | undefined;
    try {
      const savedValue = window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY);
      savedRate = PLAYBACK_RATES.find((rate) => String(rate) === savedValue);
    } catch {
      // Storage may be unavailable in a restricted browser context.
    }
    if (savedRate === undefined) return;

    const restoreTimer = window.setTimeout(() => setPlaybackRate(savedRate), 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    function restoreAudioRateWhenVisible() {
      if (document.visibilityState !== 'visible' || !audioRef.current) return;
      audioRef.current.defaultPlaybackRate = playbackRate;
      audioRef.current.playbackRate = playbackRate;
    }

    document.addEventListener('visibilitychange', restoreAudioRateWhenVisible);
    return () => document.removeEventListener('visibilitychange', restoreAudioRateWhenVisible);
  }, [playbackRate]);

  useEffect(() => {
    if (keywords.length === 0) return;

    const controller = new AbortController();
    const preparedUrls: string[] = [];

    async function prepareAllAudio() {
      try {
        for (let index = 0; index < keywords.length; index += 1) {
          const blob = await fetchKeywordAudio(className, index + 1, controller.signal);
          if (controller.signal.aborted) return;
          preparedUrls.push(URL.createObjectURL(blob));
          setPreparedCount(index + 1);
        }
        audioUrlsRef.current = preparedUrls;
        setAudioState('ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        preparedUrls.forEach((url) => URL.revokeObjectURL(url));
        audioUrlsRef.current = [];
        setAudioState('error');
      }
    }

    void prepareAllAudio();
    return () => {
      controller.abort();
      preparedUrls.forEach((url) => URL.revokeObjectURL(url));
      if (audioUrlsRef.current === preparedUrls) audioUrlsRef.current = [];
    };
  }, [className, keywords, preparationAttempt]);

  function stopAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlayingIndex(null);
  }

  function playKeyword(index: number) {
    const audio = audioRef.current;
    const audioUrl = audioUrlsRef.current[index];
    if (!audio || !audioUrl) return;

    if (playingIndex === index && !audio.paused) {
      audio.pause();
      setPlayingIndex(null);
      return;
    }

    audio.pause();
    audio.src = audioUrl;
    audio.currentTime = 0;
    audio.load();
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
    setPlaybackError(null);
    setPlayingIndex(index);
    setHeardKeywords((heard) => new Set(heard).add(index));
    void audio.play().catch(() => {
      setPlayingIndex(null);
      setPlaybackError(copy.playbackFailed);
    });
  }

  function changePlaybackRate(nextRate: PlaybackRate) {
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = nextRate;
      audioRef.current.playbackRate = nextRate;
    }
    try {
      window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(nextRate));
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
    setPlaybackRate(nextRate);
  }

  if (keywords.length === 0) {
    return (
      <main className="grid min-h-[calc(100vh-10rem)] place-items-center bg-katha-surface px-5 py-10">
        <section className="w-full max-w-lg rounded-3xl border border-katha-warning/20 bg-katha-warning/10 p-8 text-center">
          <h1 className="text-xl font-semibold text-katha-text">{copy.noKeywords}</h1>
          <p className="mt-3 text-sm leading-6 text-katha-text/55">
            {copy.noKeywordsHelp}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 cursor-pointer rounded-xl bg-katha-text px-5 py-2.5 text-sm font-semibold text-katha-surface"
          >
            {copy.backToResult}
          </button>
        </section>
      </main>
    );
  }

  if (audioState === 'preparing') {
    const progressPercent = Math.round((preparedCount / keywords.length) * 100);
    return (
      <main className="relative grid min-h-[calc(100vh-10rem)] place-items-center overflow-hidden bg-katha-surface px-5 py-10">
        <div className="pointer-events-none absolute -right-28 top-12 h-80 w-80 rounded-full bg-katha-primary/10 blur-3xl" />
        <section
          className="katha-card relative w-full max-w-lg rounded-[2rem] border border-katha-primary/20 bg-katha-text/[0.035] p-8 text-center shadow-2xl"
        >
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-katha-primary-light">
            {copy.keywordStep}
          </p>
          <KathaLoadingIndicator
            label={copy.preparingKhmerVoice}
            detail={formatCopy(copy.preparedWords, { done: preparedCount, total: keywords.length })}
            progress={progressPercent}
            compact
          />
          <p className="mt-4 text-xs leading-5 text-katha-text/40">
            {copy.lessonOpensAfterAudio}
          </p>
        </section>
      </main>
    );
  }

  if (audioState === 'error') {
    return (
      <main className="grid min-h-[calc(100vh-10rem)] place-items-center bg-katha-surface px-5 py-10">
        <section className="w-full max-w-lg rounded-3xl border border-katha-warning/20 bg-katha-warning/10 p-8 text-center">
          <h1 className="text-xl font-semibold text-katha-text">{copy.voicePreparationFailed}</h1>
          <p className="mt-3 text-sm leading-6 text-katha-text/55">
            {formatCopy(copy.voicePreparationHelp, { total: keywords.length })}
          </p>
          <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onBack}
              className="cursor-pointer rounded-xl border border-katha-text/15 px-5 py-2.5 text-sm font-semibold text-katha-text"
            >
              {copy.backToResult}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreparedCount(0);
                setPlaybackError(null);
                setAudioState('skipped');
              }}
              className="cursor-pointer rounded-xl border border-katha-warning/30 bg-katha-warning/10 px-5 py-2.5 text-sm font-semibold text-katha-text transition hover:bg-katha-warning/15"
            >
              {copy.skipKeywordAudio}
            </button>
            <button
              type="button"
              onClick={() => {
                setAudioState('preparing');
                setPreparedCount(0);
                setPlaybackError(null);
                setPreparationAttempt((attempt) => attempt + 1);
              }}
              className="cursor-pointer rounded-xl bg-katha-primary px-5 py-2.5 text-sm font-bold text-katha-text"
            >
              {copy.retryPreparation}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="relative grid min-h-[calc(100vh-10rem)] place-items-center overflow-hidden bg-katha-surface px-5 py-10">
        <div className="pointer-events-none absolute -right-28 top-12 h-80 w-80 rounded-full bg-katha-success/10 blur-3xl" />
        <section className="katha-card relative w-full max-w-2xl rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] p-7 text-center shadow-2xl sm:p-10">
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-katha-success/15 text-3xl"
            aria-hidden="true"
          >
            ✓
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-katha-success">
            {copy.completedKeywordStep}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-katha-text">
            {formatCopy(copy.learnedKeywords, { total: keywords.length })}
          </h1>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {keywords.map((keyword) => (
              <span
                key={`${keyword.khmer}-${keyword.vietnamese}`}
                lang={contentLanguage}
                className={`rounded-full border border-katha-primary/20 bg-katha-primary/10 px-4 py-2 text-lg text-katha-text ${
                  contentLanguage === 'km' ? 'font-khmer' : ''
                }`}
              >
                {contentLanguage === 'km' ? keyword.khmer : keyword.vietnamese}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-6 text-katha-text/55">
            {copy.keywordStepDone}
          </p>
          <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="cursor-pointer rounded-xl border border-katha-text/15 px-5 py-3 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.06]"
            >
              {copy.backToResult}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentIndex(0);
                setCompleted(false);
                onProgressChange?.({ currentIndex: 0, completed: false });
              }}
              className="cursor-pointer rounded-xl bg-katha-primary px-5 py-3 text-sm font-bold text-katha-text transition hover:bg-katha-primary-light"
            >
              {copy.relearnKeywords}
            </button>
            <button
              type="button"
              onClick={onContinueToStory}
              className="cursor-pointer rounded-xl bg-katha-text px-5 py-3 text-sm font-bold text-katha-surface transition hover:bg-katha-text/90"
            >
              {copy.continueStory}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const keyword = keywords[currentIndex];
  const progressPercent = ((currentIndex + 1) / keywords.length) * 100;
  const isLastKeyword = currentIndex === keywords.length - 1;

  return (
    <main className="relative min-h-[calc(100vh-10rem)] overflow-hidden bg-katha-surface px-4 py-8 sm:px-8 lg:py-12">
      <div className="pointer-events-none absolute -left-36 top-8 h-96 w-96 rounded-full bg-katha-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-katha-accent/10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl">
        <audio
          ref={audioRef}
          className="hidden"
          preload="none"
          aria-label={copy.khmerKeywordPlayer}
          onLoadedMetadata={() => {
            if (!audioRef.current) return;
            audioRef.current.defaultPlaybackRate = playbackRate;
            audioRef.current.playbackRate = playbackRate;
          }}
          onEnded={() => setPlayingIndex(null)}
          onError={() => {
            setPlayingIndex(null);
            setPlaybackError(copy.playbackFailed);
          }}
        />
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-katha-primary-light">
                {copy.keywordStep}
              </p>
              <h1
                lang={contentLanguage}
                className={`mt-2 text-2xl font-bold text-katha-text sm:text-3xl ${
                  contentLanguage === 'km' ? 'font-khmer' : ''
                }`}
              >
                {contentLanguage === 'km' ? knowledge.khmer : knowledge.vietnamese}
              </h1>
              <p
                lang={contentLanguage === 'km' ? 'vi' : 'km'}
                className={`mt-1 text-sm text-katha-text/50 ${
                  contentLanguage === 'vi' ? 'font-khmer' : ''
                }`}
              >
                {contentLanguage === 'km' ? knowledge.vietnamese : knowledge.khmer}
              </p>
            </div>
            <span className="rounded-full border border-katha-text/10 bg-katha-text/[0.04] px-4 py-2 text-sm font-semibold text-katha-text/70">
              {currentIndex + 1}/{keywords.length}
            </span>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-katha-text/10" aria-hidden="true">
            <div
              className="h-full rounded-full bg-katha-primary transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </header>

        {audioState === 'skipped' && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-katha-warning/25 bg-katha-warning/10 px-4 py-3 text-sm leading-6 text-katha-text/70"
          >
            {copy.keywordAudioSkipped}
          </div>
        )}

        <section
          className="katha-card flex min-h-[390px] flex-col items-center justify-center rounded-[2rem] border border-katha-primary/20 bg-katha-text/[0.035] p-7 text-center shadow-2xl backdrop-blur-xl sm:p-12"
          aria-live="polite"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-katha-text/40">
            {formatCopy(copy.keywordNumber, { number: currentIndex + 1 })}
          </p>
          <p
            lang={contentLanguage}
            className={`mt-8 font-semibold leading-relaxed text-katha-text ${
              contentLanguage === 'km'
                ? 'font-khmer text-5xl sm:text-6xl'
                : 'text-3xl sm:text-4xl'
            }`}
          >
            {contentLanguage === 'km' ? keyword.khmer : keyword.vietnamese}
          </p>
          <p
            lang={contentLanguage === 'km' ? 'vi' : 'km'}
            className={`mt-5 font-bold text-katha-accent ${
              contentLanguage === 'km' ? 'text-2xl' : 'font-khmer text-3xl leading-relaxed'
            }`}
          >
            {contentLanguage === 'km' ? keyword.vietnamese : keyword.khmer}
          </p>
          {keyword.transliteration && (
            <p className="mt-3 text-sm text-katha-text/50">
              {copy.transliteration}:{' '}
              <span className="font-medium text-katha-text/70">{keyword.transliteration}</span>
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => playKeyword(currentIndex)}
              disabled={audioState === 'skipped'}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-katha-primary/25 bg-katha-primary/15 px-6 py-3 text-sm font-bold text-katha-text transition hover:bg-katha-primary/25 disabled:cursor-not-allowed disabled:border-katha-text/10 disabled:bg-katha-text/[0.04] disabled:text-katha-text/40"
              aria-label={formatCopy(copy.listenToWord, { word: keyword.khmer })}
            >
              <span aria-hidden="true">{audioState === 'skipped' ? '○' : playingIndex === currentIndex ? '⏸' : '🔊'}</span>
              {audioState === 'skipped'
                ? copy.audioUnavailable
                : playingIndex === currentIndex
                  ? copy.pause
                  : heardKeywords.has(currentIndex)
                    ? copy.listenAgain
                    : copy.listenPronunciation}
            </button>
            {audioState === 'ready' && (
              <div
                className="flex items-center gap-1 rounded-full border border-katha-text/15 bg-katha-text/[0.04] p-1"
                role="group"
                aria-label={copy.pronunciationSpeed}
              >
                <span className="pl-2 pr-1 text-xs text-katha-text/55" aria-hidden="true">
                  🐢
                </span>
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => changePlaybackRate(rate)}
                    aria-pressed={playbackRate === rate}
                    aria-label={formatCopy(copy.speedTimes, { rate })}
                    className={`cursor-pointer rounded-full px-3 py-2 text-xs font-bold transition ${
                      playbackRate === rate
                        ? 'bg-katha-accent/20 text-katha-text shadow-sm'
                        : 'text-katha-text/55 hover:bg-katha-text/[0.08] hover:text-katha-text'
                    }`}
                  >
                    {rate}×
                  </button>
                ))}
              </div>
            )}
          </div>
          {playbackError && (
            <p className="mt-3 text-sm text-katha-error" role="alert">
              {playbackError}
            </p>
          )}
        </section>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopAudio();
              if (currentIndex === 0) onBack();
              else {
                const previousIndex = currentIndex - 1;
                setCurrentIndex(previousIndex);
                onProgressChange?.({ currentIndex: previousIndex, completed: false });
              }
            }}
            className="cursor-pointer rounded-xl border border-katha-text/15 px-5 py-3 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.06]"
          >
            {currentIndex === 0 ? copy.backToResult : copy.back}
          </button>

          <button
            type="button"
            onClick={() => {
              stopAudio();
              if (isLastKeyword) {
                setCompleted(true);
                onProgressChange?.({ currentIndex, completed: true });
              } else {
                const nextIndex = currentIndex + 1;
                setCurrentIndex(nextIndex);
                onProgressChange?.({ currentIndex: nextIndex, completed: false });
              }
            }}
            className="cursor-pointer rounded-xl bg-katha-primary px-6 py-3 text-sm font-bold text-katha-text transition hover:bg-katha-primary-light"
          >
            {isLastKeyword ? copy.completeKeywords : copy.nextWord}
          </button>
        </div>
      </div>
    </main>
  );
}
