'use client';

import Link from 'next/link';
import type { ReaderLanguage } from '@/features/reader/types';
import type { KhmerKeyword } from '@/features/vision/api';
import { formatSpeakingCopy, getSpeakingCopy } from '../copy';
import type { CompletedSpeakingAttempt } from '../types';
import { SpeakingStageHeader } from './SpeakingStageHeader';

interface SpeakingResultsProps {
  language: ReaderLanguage;
  attempts: CompletedSpeakingAttempt[];
  skippedCount?: number;
  keywords?: KhmerKeyword[];
  storyPageCount?: number;
  listenedPageCount?: number;
  listeningProgress?: number;
  onLanguageChange: (language: ReaderLanguage) => void;
  onPracticeAgain: () => void;
  onReadStoryAgain: () => void;
  onResetLearningJourney?: () => void;
}

function percentage(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 100));
}

function metricAverage(
  attempts: CompletedSpeakingAttempt[],
  select: (attempt: CompletedSpeakingAttempt) => number,
) {
  if (attempts.length === 0) return 0;
  return Math.round(attempts.reduce((total, attempt) => total + select(attempt), 0) / attempts.length);
}

function nullableMetricAverage(
  attempts: CompletedSpeakingAttempt[],
  select: (attempt: CompletedSpeakingAttempt) => number | null,
) {
  const values = attempts
    .map(select)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function SpeakingResults({
  language,
  attempts,
  skippedCount = 0,
  keywords = [],
  storyPageCount = 0,
  listenedPageCount = storyPageCount,
  listeningProgress = 1,
  onLanguageChange,
  onPracticeAgain,
  onReadStoryAgain,
  onResetLearningJourney,
}: SpeakingResultsProps) {
  const copy = getSpeakingCopy(language);
  const overallScore = metricAverage(attempts, (attempt) => attempt.result.score);
  const characterAccuracy = metricAverage(
    attempts,
    (attempt) => percentage(attempt.result.character_accuracy),
  );
  const termCoverage = metricAverage(
    attempts,
    (attempt) => percentage(attempt.result.required_term_coverage),
  );
  const confidence = nullableMetricAverage(
    attempts,
    (attempt) => attempt.result.confidence === null
      ? null
      : percentage(attempt.result.confidence * 100),
  );
  const totalSpeakingCount = attempts.length + skippedCount;
  const keywordCount = keywords.length;
  const normalizedListeningProgress = Math.min(Math.max(listeningProgress, 0), 1);
  const normalizedListenedPageCount = Math.min(
    Math.max(Math.floor(listenedPageCount), 0),
    storyPageCount,
  );
  const completedSectionCount = normalizedListeningProgress >= 1 ? 3 : 2;
  const readingSummaries = [
    {
      label: copy.readingCompleted,
      detail: copy.pagesRead,
      icon: '▤',
      done: storyPageCount,
      progress: 1,
    },
    {
      label: copy.listeningCompleted,
      detail: copy.pagesListened,
      icon: '◖',
      done: normalizedListenedPageCount,
      progress: normalizedListeningProgress,
    },
  ];
  const summary = attempts.length === 0
    ? copy.noSpeakingAttempts
    : overallScore >= 80
      ? copy.excellent
      : overallScore >= 60
        ? copy.good
        : copy.keepPracticing;

  return (
    <div className="min-h-dvh bg-katha-surface text-katha-text">
      <SpeakingStageHeader
        currentStep={5}
        stepProgress={1}
        language={language}
        onLanguageChange={onLanguageChange}
      />
      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">
        <section className="katha-card overflow-hidden rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] shadow-2xl backdrop-blur-xl">
          <div className="bg-gradient-to-br from-katha-success/15 via-katha-primary/10 to-katha-accent/10 px-5 py-8 sm:px-10 sm:py-11">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
              <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-8 border-katha-success/25 bg-katha-success/10 shadow-xl shadow-katha-success/10 sm:h-32 sm:w-32">
              <div>
                <strong className="block text-4xl font-black tabular-nums text-emerald-200">
                  {attempts.length === 0 ? '—' : overallScore}
                </strong>
                <span className="text-xs font-bold uppercase tracking-wider text-katha-text/45">/ 100</span>
              </div>
            </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-full border border-katha-success/25 bg-katha-success/10 px-3 py-1 text-xs font-bold text-emerald-200">
                    ✓ {copy.completedStage}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-katha-text/45">
                    {copy.overallScore}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{copy.resultsTitle}</h1>
                <p className="mt-2 text-sm text-katha-text/60">
                  {formatSpeakingCopy(copy.resultsSubtitle, { count: attempts.length })}
                </p>
                <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-emerald-100/90">{summary}</p>
                <Link
                  href="/admin/vision"
                  onClick={(event) => {
                    if (!onResetLearningJourney) return;
                    event.preventDefault();
                    onResetLearningJourney();
                  }}
                  className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-katha-text px-5 text-sm font-bold text-katha-surface transition hover:-translate-y-0.5 hover:bg-katha-text/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold"
                >
                  <span aria-hidden="true">⌁</span>
                  {copy.newRecognition}
                </Link>
              </div>
            </div>
          </div>

          <div className="px-5 py-7 sm:px-10 sm:py-9">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-katha-primary-light">
                  {copy.journeySummary}
                </p>
                <h2 className="mt-1 text-xl font-bold text-katha-text sm:text-2xl">
                  {copy.learningDetails}
                </h2>
              </div>
              <span className="rounded-full bg-katha-success/10 px-3 py-1 text-xs font-bold text-emerald-200">
                {completedSectionCount}/3 {copy.completedSections}
              </span>
            </div>

            <section className="mt-6 overflow-hidden rounded-3xl border border-katha-gold/20 bg-katha-gold/[0.045]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-katha-gold/15 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-katha-gold/15 font-black text-katha-gold">01</span>
                  <div>
                    <h3 className="font-bold text-katha-text">{copy.keywordStage}</h3>
                    <p className="text-xs text-katha-text/45">{copy.vocabularySectionHelp}</p>
                  </div>
                </div>
                <span className="rounded-full border border-katha-gold/20 bg-katha-gold/10 px-3 py-1 text-xs font-bold text-katha-gold">
                  {formatSpeakingCopy(copy.keywordCount, { count: keywordCount })}
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {keywords.map((keyword, index) => (
                  <article key={`${keyword.khmer}-${index}`} className="rounded-2xl border border-katha-text/10 bg-katha-surface/35 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-katha-gold/12 text-xs font-black text-katha-gold">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <strong lang="km" className="block font-khmer text-xl leading-relaxed text-katha-text">
                          {keyword.khmer}
                        </strong>
                        <span lang="vi" className="mt-1 block text-sm font-semibold text-katha-text/75">
                          {keyword.vietnamese}
                        </span>
                        {keyword.transliteration && (
                          <span className="mt-1 block text-xs italic text-katha-text/40">
                            {keyword.transliteration}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border border-katha-primary/20 bg-katha-primary/[0.045]">
              <div className="flex items-center gap-3 border-b border-katha-primary/15 px-5 py-4 sm:px-6">
                <span className="grid size-10 place-items-center rounded-xl bg-katha-primary/15 font-black text-katha-primary-light">02</span>
                <div>
                  <h3 className="font-bold text-katha-text">{copy.readingStage}</h3>
                  <p className="text-xs text-katha-text/45">{copy.readingSectionHelp}</p>
                </div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {readingSummaries.map((summaryItem) => {
                  const completed = summaryItem.progress >= 1;
                  return (
                  <article key={summaryItem.label} className="rounded-2xl border border-katha-text/10 bg-katha-surface/35 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-2xl text-katha-primary-light" aria-hidden="true">{summaryItem.icon}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        completed
                          ? 'bg-katha-success/12 text-emerald-200'
                          : 'bg-katha-warning/12 text-amber-200'
                      }`}>
                        {completed
                          ? `✓ ${copy.completedStage}`
                          : `${Math.round(summaryItem.progress * 100)}%`}
                      </span>
                    </div>
                    <strong className="mt-4 block text-base text-katha-text">{summaryItem.label}</strong>
                    <span className="mt-1 block text-sm text-katha-text/50">
                      {formatSpeakingCopy(summaryItem.detail, {
                        done: summaryItem.done,
                        total: storyPageCount,
                      })}
                    </span>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-katha-text/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-katha-primary to-katha-success transition-[width] duration-500"
                        style={{ width: `${summaryItem.progress * 100}%` }}
                      />
                    </div>
                  </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border border-katha-success/20 bg-katha-success/[0.04]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-katha-success/15 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-katha-success/15 font-black text-katha-success">03</span>
                  <div>
                    <h3 className="font-bold text-katha-text">{copy.speakingStage}</h3>
                    <p className="text-xs text-katha-text/45">{copy.speakingSectionHelp}</p>
                  </div>
                </div>
                <span className="rounded-full border border-katha-success/20 bg-katha-success/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  {formatSpeakingCopy(copy.speakingAttemptCount, { done: attempts.length, total: totalSpeakingCount })}
                </span>
              </div>

            {attempts.length > 0 && (
              <>
                <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
              {[
                [copy.characterAccuracy, characterAccuracy],
                [copy.termCoverage, termCoverage],
                [copy.confidence, confidence],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-katha-text/10 bg-katha-surface/35 p-4 text-center">
                  <strong className="block text-2xl font-black tabular-nums text-katha-primary-light">
                    {value === null ? '—' : `${value}%`}
                  </strong>
                  <span className="mt-1 block text-xs font-semibold text-katha-text/50">{label}</span>
                </div>
              ))}
                </div>

                <div className="space-y-4 px-4 pb-5 sm:px-5">
              {attempts.map((attempt, index) => {
                const score = Math.round(attempt.result.score);
                return (
                  <article key={attempt.sentence.id} className="rounded-2xl border border-katha-text/10 bg-katha-text/[0.025] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-katha-text/40">
                          {formatSpeakingCopy(copy.sentenceResult, { number: index + 1 })}
                        </p>
                        <h2 lang="km" className="mt-2 font-khmer text-2xl leading-relaxed text-katha-text">{attempt.sentence.khmer}</h2>
                        <p lang="vi" className="mt-1 text-sm text-katha-text/55">{attempt.sentence.vietnamese}</p>
                      </div>
                      <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border text-lg font-black ${
                        score >= 80
                          ? 'border-katha-success/35 bg-katha-success/10 text-emerald-200'
                          : score >= 60
                            ? 'border-katha-warning/35 bg-katha-warning/10 text-amber-200'
                            : 'border-katha-error/35 bg-katha-error/10 text-red-200'
                      }`}>
                        {score}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-katha-text/[0.035] p-4">
                      <p className="text-xs font-semibold text-katha-text/40">{copy.heardAs}</p>
                      <p lang="km" className="mt-1 break-words font-khmer text-lg leading-relaxed text-katha-text/85">{attempt.result.transcript || '—'}</p>
                      <p lang="vi" className="mt-2 text-sm leading-6 text-katha-text/55">{attempt.result.feedback_vi}</p>
                    </div>

                    {(attempt.result.matched_segments.length > 0 || attempt.result.missing_segments.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {attempt.result.matched_segments.map((segment) => (
                          <span key={`matched-${segment}`} lang="km" className="rounded-full bg-katha-success/12 px-3 py-1 font-khmer text-sm text-emerald-200">✓ {segment}</span>
                        ))}
                        {attempt.result.missing_segments.map((segment) => (
                          <span key={`missing-${segment}`} lang="km" className="rounded-full bg-katha-warning/12 px-3 py-1 font-khmer text-sm text-amber-200">△ {segment}</span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
                </div>
              </>
            )}
              {attempts.length === 0 && (
                <p className="p-5 text-sm leading-6 text-katha-text/55">{copy.noSpeakingAttempts}</p>
              )}
              {skippedCount > 0 && (
                <p className="border-t border-katha-success/10 px-5 py-3 text-xs font-semibold text-katha-warning">
                  {formatSpeakingCopy(copy.skippedCount, { count: skippedCount })}
                </p>
              )}
            </section>

            <div className="mt-9 border-t border-katha-text/10 pt-7">
              <h2 className="text-center text-lg font-bold text-katha-text">
                {copy.nextJourney}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Link
                  href="/admin/vision"
                  onClick={(event) => {
                    if (!onResetLearningJourney) return;
                    event.preventDefault();
                    onResetLearningJourney();
                  }}
                  className="flex min-h-32 cursor-pointer flex-col rounded-2xl border border-katha-success/25 bg-katha-success/[0.07] p-5 transition hover:-translate-y-0.5 hover:border-katha-success/45 hover:bg-katha-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-success"
                >
                  <span aria-hidden="true" className="text-2xl">⌁</span>
                  <strong className="mt-3 text-sm text-katha-text">{copy.newRecognition}</strong>
                  <span className="mt-1 text-xs leading-5 text-katha-text/50">{copy.newRecognitionHelp}</span>
                </Link>

                <Link
                  href="/admin/museum"
                  className="group flex min-h-32 cursor-pointer flex-col rounded-2xl border border-katha-gold/30 bg-katha-gold/[0.08] p-5 transition hover:-translate-y-0.5 hover:border-katha-gold/50 hover:bg-katha-gold/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-katha-gold/15 text-sm font-black text-katha-gold">
                      360°
                    </span>
                    <span className="rounded-full border border-katha-gold/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-katha-gold">
                      Beta
                    </span>
                  </span>
                  <strong className="mt-4 text-sm text-katha-text">{copy.exploreMuseum}</strong>
                  <span className="mt-1 text-xs leading-5 text-katha-text/50">
                    {copy.exploreMuseumHelp}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={onPracticeAgain}
                  className="flex min-h-32 cursor-pointer flex-col rounded-2xl border border-katha-primary/25 bg-katha-primary/[0.07] p-5 text-left transition hover:-translate-y-0.5 hover:border-katha-primary/45 hover:bg-katha-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary"
                >
                  <span aria-hidden="true" className="text-2xl">↻</span>
                  <strong className="mt-3 text-sm text-katha-text">{copy.practiceAgain}</strong>
                  <span className="mt-1 text-xs leading-5 text-katha-text/50">
                    {copy.practiceAgainHelp}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onReadStoryAgain}
                  className="flex min-h-32 cursor-pointer flex-col rounded-2xl border border-katha-text/12 bg-katha-text/[0.025] p-5 text-left transition hover:-translate-y-0.5 hover:border-katha-text/25 hover:bg-katha-text/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary"
                >
                  <span aria-hidden="true" className="text-2xl">◫</span>
                  <strong className="mt-3 text-sm text-katha-text">{copy.readStoryAgain}</strong>
                  <span className="mt-1 text-xs leading-5 text-katha-text/50">
                    {copy.readStoryAgainHelp}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
