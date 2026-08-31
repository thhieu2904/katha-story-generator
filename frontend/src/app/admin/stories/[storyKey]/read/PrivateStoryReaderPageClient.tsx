'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StoryReader } from '@/features/reader/components/StoryReader';
import {
  fetchPrivateStoryLearningContext,
  fetchPrivateStoryPageAudio,
  preparePrivateStoryAudio,
} from '@/features/reader/private-api';
import type { PublicStory } from '@/features/reader/types';
import { hasVisionLearningContextInDescription } from '@/features/learning/visionStoryDraft';
import { fetchStoryImages } from '@/features/story-images/api';
import type { StoryImagesState } from '@/features/story-images/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import type { StoryRouteKey } from '@/features/stories/types';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import { LearningProgressBar } from '@/features/learning/components/LearningProgressBar';
import { useAuth } from '@/features/auth/useAuth';
import { resetLearningJourneyProgress } from '@/features/learning/resetLearningJourney';

const POLL_INTERVAL_MS = 3000;

export function PrivateStoryReaderPageClient({
  storyKey,
  startLearning = false,
  visionFlow = false,
  restartLearningSession = false,
}: {
  storyKey: StoryRouteKey;
  startLearning?: boolean;
  visionFlow?: boolean;
  restartLearningSession?: boolean;
}) {
  const router = useRouter();
  const { copy, language } = useUiCopy();
  const { user } = useAuth();
  const { story, loading: storyLoading, error: storyError, retry } = useStoryByRouteKey(storyKey);
  const storyId = story?.id ?? null;
  const [images, setImages] = useState<StoryImagesState | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [learningContextState, setLearningContextState] = useState<{
    storyId: number;
    context: NonNullable<PublicStory['learning_context']> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!storyId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const load = async () => {
      controller = new AbortController();
      try {
        const state = await fetchStoryImages(storyId, controller.signal);
        if (!active) return;
        setImages(state);
        setImagesError(null);
        if (state.status === 'generating_images' && !state.job_stale) {
          timer = setTimeout(load, POLL_INTERVAL_MS);
        }
      } catch (reason) {
        if (!active || (reason instanceof DOMException && reason.name === 'AbortError')) return;
        setImagesError(reason instanceof Error ? reason.message : '');
      }
    };

    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [storyId]);

  const hasVisionLesson = story
    ? hasVisionLearningContextInDescription(story.description_vi)
    : false;
  const learningContext = learningContextState?.storyId === storyId
    ? learningContextState.context
    : null;
  const learningContextError = learningContextState?.storyId === storyId
    ? learningContextState.error
    : null;
  const learningContextLoading = Boolean(
    storyId && hasVisionLesson && learningContextState?.storyId !== storyId,
  );

  useEffect(() => {
    if (!storyId || !hasVisionLesson) return;

    const controller = new AbortController();
    void fetchPrivateStoryLearningContext(storyId, controller.signal)
      .then((context) => {
        setLearningContextState({ storyId, context, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLearningContextState({
          storyId,
          context: null,
          error: reason instanceof Error ? reason.message : '',
        });
      });

    return () => controller.abort();
  }, [hasVisionLesson, storyId]);

  const privateStory = useMemo<PublicStory | null>(() => {
    if (!story || !images || !['pending_review', 'approved', 'published'].includes(images.status)) {
      return null;
    }
    const pages = images.pages
      .slice()
      .sort((left, right) => left.page_no - right.page_no)
      .map((page) => ({
        page_no: page.page_no,
        text_km: page.text_km,
        text_vi: page.text_vi,
        image_url: page.image_url,
      }));
    return {
      title_km: story.title_km,
      title_vi: story.title_vi,
      target_age: story.target_age,
      page_count: pages.length,
      cover: { background_url: pages[0]?.image_url ?? null },
      pages,
      learning_context: learningContext,
    };
  }, [images, learningContext, story]);

  const loadPageAudio = useCallback(
    (pageNo: number, signal?: AbortSignal) => {
      if (!storyId) return Promise.reject(new Error(copy.storyNotReady));
      return fetchPrivateStoryPageAudio(storyId, pageNo, signal);
    },
    [copy.storyNotReady, storyId],
  );
  const prepareNarration = useCallback(() => {
    if (!storyId) return Promise.reject(new Error(copy.storyNotReady));
    return preparePrivateStoryAudio(storyId);
  }, [copy.storyNotReady, storyId]);
  const resetLearningJourney = useCallback(() => {
    resetLearningJourneyProgress();
    router.replace('/admin/vision');
  }, [router]);
  const restartLearningJourney = useCallback(() => {
    router.replace(`/admin/vision?story=${encodeURIComponent(storyKey)}`);
  }, [router, storyKey]);
  const consumeRestartLearningSession = useCallback(() => {
    router.replace(`/admin/stories/${encodeURIComponent(storyKey)}/read?source=vision`);
  }, [router, storyKey]);

  const showPendingLearningProgress = visionFlow && !startLearning;

  if (storyLoading) {
    return (
      <PrivateReaderStatus
        title={copy.loadingStory}
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }
  if (storyError || !story) {
    return (
      <PrivateReaderStatus
        title={copy.cannotLoadStory}
        detail={language === 'vi' ? storyError : null}
        onRetry={retry}
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }
  if (imagesError) {
    return (
      <PrivateReaderStatus
        title={copy.cannotLoadPrivateReader}
        detail={language === 'vi' ? imagesError || copy.privateReaderLoadFailed : copy.privateReaderLoadFailed}
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }
  if ((startLearning || visionFlow) && hasVisionLesson && learningContextLoading) {
    return (
      <PrivateReaderStatus
        title={copy.reloadingKeywordLesson}
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }
  if ((startLearning || visionFlow) && hasVisionLesson && learningContextError) {
    return (
      <PrivateReaderStatus
        title={copy.cannotOpenLessonAgain}
        detail={
          language === 'vi'
            ? learningContextError || copy.keywordLessonReloadFailed
            : copy.keywordLessonReloadFailed
        }
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }
  if (!images || images.status === 'generating_images') {
    const completed = images?.progress.completed ?? 0;
    const total = images?.progress.total ?? 0;
    return (
      <PrivateReaderStatus
        title={copy.completingStoryImages}
        detail={formatCopy(copy.completedImagesReaderOpens, { done: completed, total })}
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }
  if (!privateStory) {
    return (
      <PrivateReaderStatus
        title={copy.storyNotReadyToRead}
        detail={copy.checkContentAndImages}
        href={`/admin/stories/${storyKey}/images`}
        copy={copy}
        language={language}
        showLearningProgress={showPendingLearningProgress}
      />
    );
  }

  return (
    <StoryReader
      story={privateStory}
      pageAudioLoader={loadPageAudio}
      prepareNarration={prepareNarration}
      initialLearningActive={
        Boolean(privateStory.learning_context) && (startLearning || visionFlow)
      }
      initialLearningMode={startLearning && privateStory.learning_context ? 'keywords' : 'reader'}
      learningSessionKey={user ? `private-story-${story.id}-user-${user.id}` : undefined}
      speakingStoryId={story.id}
      restartLearningSession={restartLearningSession}
      onRestartLearningSessionConsumed={consumeRestartLearningSession}
      onRestartLearningJourney={restartLearningJourney}
      onResetLearningJourney={resetLearningJourney}
    />
  );
}

function PrivateReaderStatus({
  title,
  detail,
  href,
  onRetry,
  copy,
  language,
  showLearningProgress = false,
}: {
  title: string;
  detail?: string | null;
  href?: string;
  onRetry?: () => void;
  copy: ReturnType<typeof useUiCopy>['copy'];
  language: ReturnType<typeof useUiCopy>['language'];
  showLearningProgress?: boolean;
}) {
  return (
    <main className="min-h-dvh bg-katha-surface px-5 py-6">
      {showLearningProgress && (
        <div className="katha-card mx-auto mb-8 w-full max-w-[1400px] rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-lg sm:p-5">
          <LearningProgressBar currentStep={3} stepProgress={0} language={language} />
        </div>
      )}
      <section className="mx-auto mt-[12vh] w-full max-w-lg rounded-3xl border border-katha-text/10 bg-katha-text/[0.035] p-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-katha-text/15 border-t-katha-primary" />
        <h1 className="mt-5 text-xl font-bold text-katha-text">{title}</h1>
        {detail && <p className="mt-3 text-sm leading-6 text-katha-text/55">{detail}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-5 rounded-xl bg-katha-primary px-5 py-2.5 text-sm font-semibold">
            {copy.retry}
          </button>
        )}
        {href && (
          <Link href={href} className="mt-5 inline-block rounded-xl bg-katha-primary px-5 py-2.5 text-sm font-semibold">
            {copy.checkProgress}
          </Link>
        )}
      </section>
    </main>
  );
}
