'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/useAuth';
import { classifyImage, type VisionResult } from '@/features/vision/api';
import { KeywordLesson } from './KeywordLesson';
import { LearningJourneyControls } from './LearningJourneyControls';
import { KathaLoadingIndicator } from '@/components/feedback/KathaLoading';
import { LearningProgressBar } from './LearningProgressBar';
import {
  clearVisionLearningProgress,
  loadVisionLearningProgress,
  saveVisionLearningProgress,
  type KeywordLessonProgress,
} from '../visionLearningProgress';
import { saveVisionStoryDraft } from '../visionStoryDraft';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { getUiCopy } from '@/features/language/uiCopy';
import { fetchStoryByRouteKey } from '@/features/stories/api';
import type { StoryRouteKey } from '@/features/stories/types';
import { fetchPrivateStoryLearningContext } from '@/features/reader/private-api';
import { getVisionSampleImage } from '../visionSampleImages';
import { clearSpeakingLearningProgress } from '@/features/speaking/progress';
import { fetchStoryImages } from '@/features/story-images/api';
import { resetLearningJourneyProgress } from '../resetLearningJourney';
import {
  prepareVisionImage,
  VisionImagePreparationError,
} from '@/features/vision/imageUpload';

interface VisionLearningFlowProps {
  initialStoryKey?: StoryRouteKey | null;
}

export function VisionLearningFlow({ initialStoryKey = null }: VisionLearningFlowProps = {}) {
  const router = useRouter();
  const { language: contentLanguage } = useContentLanguage();
  const copy = getUiCopy(contentLanguage);
  const { user } = useAuth();
  const userId = user?.id;
  const [stage, setStage] = useState<'vision' | 'keywords'>('vision');
  const [result, setResult] = useState<VisionResult | null>(null);
  const [keywordProgress, setKeywordProgress] = useState<KeywordLessonProgress>({
    currentIndex: 0,
    completed: false,
  });
  const [restoringProgress, setRestoringProgress] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleResult, setSampleResult] = useState(false);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const restoreTimer = window.setTimeout(() => {
      if (initialStoryKey) {
        void (async () => {
          try {
            const story = await fetchStoryByRouteKey(initialStoryKey);
            const learningContext = await fetchPrivateStoryLearningContext(
              story.id,
              controller.signal,
            );
            let sampleImage = getVisionSampleImage(learningContext.class_name);

            // Relearning should show the classifier's stable sample for the
            // recognized class. A story illustration is only a compatibility
            // fallback for a future/legacy class without a bundled sample.
            if (!sampleImage) {
              const storyImages = await fetchStoryImages(story.id, controller.signal).catch(
                () => null,
              );
              sampleImage =
                storyImages?.pages
                  .slice()
                  .sort((left, right) => left.page_no - right.page_no)
                  .find((page) => Boolean(page.image_url))
                  ?.image_url ?? null;
            }

            if (!sampleImage) {
              throw new Error('VISION_SAMPLE_UNAVAILABLE');
            }
            if (controller.signal.aborted) return;

            // Commit the restart only after the story context and a usable image
            // have both been restored. A transient request failure must not erase
            // the learner's previous snapshot.
            if (userId) {
              clearVisionLearningProgress(userId);
              clearSpeakingLearningProgress(`private-story-${story.id}-user-${userId}`);
            }

            setResult({
              class: learningContext.class_name,
              predicted_class: learningContext.class_name,
              confidence: 1,
              knowledge: learningContext.knowledge,
            });
            setPreviewUrl(sampleImage);
            setSampleResult(true);
            setKeywordProgress({ currentIndex: 0, completed: false });
            setStage('vision');
            setError(null);
          } catch (reason) {
            if (controller.signal.aborted) return;
            setResult(null);
            setPreviewUrl(null);
            setSampleResult(false);
            setStage('vision');
            setError(
              reason instanceof Error && reason.message === 'VISION_SAMPLE_UNAVAILABLE'
                ? copy.visionSampleUnavailable
                : copy.visionSampleLoadFailed,
            );
          } finally {
            if (!controller.signal.aborted) setRestoringProgress(false);
          }
        })();
        return;
      }

      const savedProgress = userId ? loadVisionLearningProgress(userId) : null;
      if (savedProgress) {
        setResult(savedProgress.result);
        setKeywordProgress(savedProgress.keyword);
        setStage('keywords');
      }
      setRestoringProgress(false);
    }, 0);

    return () => {
      window.clearTimeout(restoreTimer);
      controller.abort();
    };
  }, [copy.visionSampleLoadFailed, copy.visionSampleUnavailable, initialStoryKey, userId]);

  async function handleFile(file: File) {
    setResult(null);
    setSampleResult(false);
    setError(null);
    setLoading(true);

    try {
      const uploadFile = await prepareVisionImage(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const nextPreview = URL.createObjectURL(uploadFile);
      previewRef.current = nextPreview;
      setPreviewUrl(nextPreview);
      setResult(await classifyImage(uploadFile));
    } catch (reason) {
      if (reason instanceof VisionImagePreparationError) {
        setError(reason.code === 'too_large' ? copy.imageTooLarge : copy.unsupportedImage);
      } else {
        setError(
          contentLanguage === 'vi' && reason instanceof Error
            ? reason.message
            : copy.recognitionFailed,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function resetImage() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setResult(null);
    setSampleResult(false);
    setError(null);
    setLoading(false);
    setStage('vision');
    setKeywordProgress({ currentIndex: 0, completed: false });
    if (userId) clearVisionLearningProgress(userId);
    if (initialStoryKey) router.replace('/admin/vision');
  }

  function startLearning() {
    if (!result?.knowledge?.keywords?.length || !userId) return;
    const nextProgress = { currentIndex: 0, completed: false };
    setKeywordProgress(nextProgress);
    saveVisionLearningProgress(userId, {
      result: { ...result, knowledge: result.knowledge },
      keyword: nextProgress,
    });
    setStage('keywords');
  }

  function updateKeywordProgress(nextProgress: KeywordLessonProgress) {
    setKeywordProgress(nextProgress);
    if (!userId || !result?.knowledge) return;
    saveVisionLearningProgress(userId, {
      result: { ...result, knowledge: result.knowledge },
      keyword: nextProgress,
    });
  }

  function returnToVisionResult() {
    setStage('vision');
  }

  function resetWholeLearningJourney() {
    resetLearningJourneyProgress();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setResult(null);
    setSampleResult(false);
    setError(null);
    setLoading(false);
    setStage('vision');
    setKeywordProgress({ currentIndex: 0, completed: false });
    router.replace('/admin/vision');
  }

  function continueToStory() {
    if (!result?.knowledge) return;

    if (initialStoryKey) {
      router.push(`/admin/stories/${initialStoryKey}/read?source=vision&restart=1`);
      return;
    }

    saveVisionStoryDraft(result.class, result.knowledge);
    router.push('/admin/stories/new?source=vision');
  }

  const confidencePercent = result ? Math.round(result.confidence * 100) : 0;
  const hasKeywords = Boolean(result?.knowledge?.keywords?.length);
  const recognitionStepProgress = result ? 1 : previewUrl ? 0.5 : 0;
  const keywordCount = result?.knowledge?.keywords.length ?? 0;
  const keywordStepProgress = keywordCount > 0
    ? keywordProgress.completed
      ? 1
      : Math.min((keywordProgress.currentIndex + 1) / keywordCount, 1)
    : 0;

  if (restoringProgress) {
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-katha-surface">
        <KathaLoadingIndicator label={copy.visionRestoring} compact />
      </main>
    );
  }

  if (stage === 'keywords' && result?.knowledge) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-katha-surface">
        <div className="relative z-10 mx-auto max-w-3xl px-4 pt-6 sm:px-8">
          <div className="katha-card rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-lg backdrop-blur-xl sm:p-5">
            <LearningProgressBar
              currentStep={2}
              stepProgress={keywordStepProgress}
              language={contentLanguage}
            />
          </div>
        </div>
        <KeywordLesson
          className={result.class}
          knowledge={result.knowledge}
          initialProgress={keywordProgress}
          onProgressChange={updateKeywordProgress}
          onBack={returnToVisionResult}
          onContinueToStory={continueToStory}
        />
        <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-8">
          <LearningJourneyControls
            language={contentLanguage}
            onReset={resetWholeLearningJourney}
            className="border-t border-katha-text/10 pt-5"
          />
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-8 sm:px-8 lg:py-12">
      <div className="katha-vision-glow pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-katha-accent/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-6 text-center">
          <p className="katha-eyebrow text-xs font-bold uppercase tracking-[0.24em] text-katha-primary-light">
            {copy.visionEyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-katha-text sm:text-4xl">
            {copy.visionTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-katha-text/55 sm:text-base">
            {copy.visionSubtitle}
          </p>
        </header>

        <div className="katha-card mb-8 rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-lg backdrop-blur-xl sm:p-5">
          <LearningProgressBar
            currentStep={1}
            stepProgress={recognitionStepProgress}
            language={contentLanguage}
          />
        </div>

        <div className={`grid gap-6 ${previewUrl ? 'lg:grid-cols-[0.9fr_1.1fr]' : ''}`}>
          <section className="katha-card rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-2xl backdrop-blur-xl sm:p-6">
            {!previewUrl ? (
              <div
                className={`flex min-h-[420px] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 text-center transition ${
                  dragActive
                    ? 'border-katha-primary bg-katha-primary/10'
                    : 'border-katha-text/15 bg-katha-field hover:border-katha-text/30'
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void handleFile(file);
                }}
              >
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-katha-primary/15 text-katha-primary-light">
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                <h2 className="mt-6 text-xl font-semibold text-katha-text">{copy.addImage}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-katha-text/45">
                  {copy.imageHelp}
                </p>

                <div className="mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                  <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-katha-primary px-5 text-sm font-bold text-katha-text transition hover:bg-katha-primary-light">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                    </svg>
                    {copy.uploadImage}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label={copy.uploadImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>

                  <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-katha-text/15 bg-katha-text/[0.04] px-5 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.08]">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M5 7h2l1-2h8l1 2h2a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z" />
                    </svg>
                    {copy.takePhoto}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      capture="environment"
                      className="sr-only"
                      aria-label={copy.takePhoto}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="relative min-h-[420px] overflow-hidden rounded-[1.5rem] bg-black/25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={sampleResult ? copy.visionSampleImageAlt : copy.recognizingImageAlt}
                  className="h-full min-h-[420px] w-full object-contain"
                />

                {loading && (
                  <div
                    className="absolute inset-0 grid place-items-center bg-katha-surface/75 backdrop-blur-sm"
                    role="status"
                  >
                    <KathaLoadingIndicator
                      label={copy.recognizing}
                      detail={copy.analyzingCulture}
                      compact
                    />
                  </div>
                )}

                {!loading && (
                  <button
                    type="button"
                    onClick={resetImage}
                    className="absolute right-3 top-3 cursor-pointer rounded-full border border-katha-text/15 bg-black/60 px-4 py-2 text-xs font-semibold text-katha-text backdrop-blur transition hover:bg-black/80"
                  >
                    {copy.chooseAnotherImage}
                  </button>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </div>
            )}
          </section>

          {previewUrl && (
            <section className="katha-card rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              {loading && (
                <div className="space-y-5 animate-pulse" aria-hidden="true">
                  <div className="h-8 w-2/3 rounded-lg bg-katha-text/10" />
                  <div className="h-20 rounded-2xl bg-katha-text/[0.06]" />
                  <div className="h-32 rounded-2xl bg-katha-text/[0.06]" />
                  <div className="h-12 rounded-xl bg-katha-text/[0.06]" />
                </div>
              )}

              {!loading && result && (
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-katha-text/45">
                        {sampleResult ? copy.visionSampleResult : copy.recognitionResult}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          result.class === 'unknown'
                            ? 'bg-katha-warning/15 text-amber-200'
                            : 'bg-katha-success/15 text-emerald-200'
                        }`}
                      >
                        {sampleResult
                          ? copy.visionSampleBadge
                          : result.class === 'unknown'
                            ? copy.uncertain
                            : copy.recognized}
                      </span>
                    </div>

                    <h2
                      lang={contentLanguage}
                      className={`mt-3 text-2xl font-bold text-katha-text ${
                        contentLanguage === 'km' ? 'font-khmer' : 'capitalize'
                      }`}
                    >
                      {result.class === 'unknown'
                        ? copy.unknown
                        : contentLanguage === 'km' && result.knowledge
                          ? result.knowledge.khmer
                          : result.knowledge?.vietnamese ?? result.class.replaceAll('_', ' ')}
                    </h2>

                    {!sampleResult && (
                      <div className="mt-4">
                        <div className="mb-2 flex justify-between text-xs text-katha-text/50">
                          <span>{copy.confidence}</span>
                          <span className="font-semibold text-katha-text/75">
                            {confidencePercent}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-katha-text/10">
                          <div
                            className={`h-full rounded-full ${
                              confidencePercent >= 70 ? 'bg-katha-success' : 'bg-katha-warning'
                            }`}
                            style={{ width: `${confidencePercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {result.knowledge ? (
                    <>
                      <div className="rounded-2xl border border-katha-primary/20 bg-katha-primary/10 p-5">
                        <p
                          lang={contentLanguage}
                          className={`text-katha-accent ${
                            contentLanguage === 'km'
                              ? 'font-khmer text-3xl leading-relaxed'
                              : 'text-lg font-semibold'
                          }`}
                        >
                          {contentLanguage === 'km'
                            ? result.knowledge.khmer
                            : result.knowledge.vietnamese}
                        </p>
                        <p
                          lang={contentLanguage === 'km' ? 'vi' : 'km'}
                          className={`mt-2 text-katha-text/70 ${
                            contentLanguage === 'km'
                              ? 'text-sm font-medium'
                              : 'font-khmer text-2xl leading-relaxed'
                          }`}
                        >
                          {contentLanguage === 'km'
                            ? result.knowledge.vietnamese
                            : result.knowledge.khmer}
                        </p>
                        <p className="mt-1 text-sm text-katha-text/50">
                          {copy.transliteration}: {result.knowledge.transliteration}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-katha-text/80">
                          {copy.culturalMeaning}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-katha-text/60">
                          {result.knowledge.cultural_explanation}
                        </p>
                      </div>

                      {result.knowledge.sources.length > 0 && (
                        <div className="border-t border-katha-text/10 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-katha-text/35">
                            {copy.sources}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {result.knowledge.sources.map((source) => (
                              <a
                                key={source.url}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-katha-text/10 bg-katha-text/[0.04] px-3 py-1.5 text-xs text-katha-text/60 transition hover:border-katha-text/20 hover:text-katha-text"
                              >
                                {source.publisher}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={startLearning}
                        disabled={!hasKeywords}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-katha-text px-5 py-3.5 text-sm font-bold text-katha-surface transition hover:bg-katha-text/90 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {hasKeywords ? copy.startLearning : copy.keywordsUpdating}
                        <span aria-hidden="true">→</span>
                      </button>

                    </>
                  ) : (
                    <div className="rounded-2xl border border-katha-warning/20 bg-katha-warning/10 p-5">
                      <h3 className="font-semibold text-amber-100">{copy.clearerImageTitle}</h3>
                      <p className="mt-2 text-sm leading-6 text-katha-text/55">
                        {copy.clearerImageHelp}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
