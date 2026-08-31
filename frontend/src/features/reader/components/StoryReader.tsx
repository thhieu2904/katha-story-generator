import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicStory, ReaderLanguage } from '../types';
import { StoryCover } from './StoryCover';
import { ReaderPage } from './ReaderPage';
import { ReaderControls } from './ReaderControls';
import { ReaderLanguageToggle } from './ReaderLanguageToggle';
import { KathaLogo } from '@/components/layout/KathaLogo';
import { KathaLoadingIndicator } from '@/components/feedback/KathaLoading';
import { fetchSharedStoryPageAudio } from '../api';
import { KeywordLesson } from '@/features/learning/components/KeywordLesson';
import { LearningProgressBar } from '@/features/learning/components/LearningProgressBar';
import { LearningJourneyControls } from '@/features/learning/components/LearningJourneyControls';
import type { KeywordLessonProgress } from '@/features/learning/visionLearningProgress';
import { formatCopy, getUiCopy } from '@/features/language/uiCopy';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { SpeakingPractice } from '@/features/speaking/components/SpeakingPractice';
import { SpeakingResults } from '@/features/speaking/components/SpeakingResults';
import { getSpeakingCopy } from '@/features/speaking/copy';
import {
  clearSpeakingLearningProgress,
  loadSpeakingLearningProgress,
  saveSpeakingLearningProgress,
} from '@/features/speaking/progress';
import type { CompletedSpeakingAttempt } from '@/features/speaking/types';

interface StoryReaderProps {
  story: PublicStory;
  shareToken?: string;
  pageAudioLoader?: (pageNo: number, signal?: AbortSignal) => Promise<Blob>;
  prepareNarration?: () => Promise<unknown>;
  initialLearningActive?: boolean;
  initialLearningMode?: 'reader' | 'keywords';
  learningSessionKey?: string;
  speakingStoryId?: number;
  restartLearningSession?: boolean;
  onRestartLearningSessionConsumed?: () => void;
  onRestartLearningJourney?: () => void;
  onResetLearningJourney?: () => void;
}

export function StoryReader({
  story,
  shareToken,
  pageAudioLoader,
  prepareNarration,
  initialLearningActive = false,
  initialLearningMode = 'reader',
  learningSessionKey,
  speakingStoryId,
  restartLearningSession = false,
  onRestartLearningSessionConsumed,
  onRestartLearningJourney,
  onResetLearningJourney,
}: StoryReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const { language, setLanguage } = useContentLanguage();
  const [narrationState, setNarrationState] = useState<
    'idle' | 'preparing' | 'loading' | 'playing' | 'paused' | 'finished' | 'error'
  >('idle');
  const [preparationProgress, setPreparationProgress] = useState({ completed: 0, total: 0 });
  const [learningMode, setLearningMode] = useState<
    'reader' | 'keywords' | 'speaking' | 'results'
  >(initialLearningMode);
  const [learningActive, setLearningActive] = useState(initialLearningActive);
  const [speakingAttempts, setSpeakingAttempts] = useState<CompletedSpeakingAttempt[]>([]);
  const [speakingSkippedSentenceIds, setSpeakingSkippedSentenceIds] = useState<string[]>([]);
  const [speakingSessionId, setSpeakingSessionId] = useState<string>();
  const [speakingRestartVersion, setSpeakingRestartVersion] = useState(0);
  const [listeningProgressByPage, setListeningProgressByPage] = useState<Record<number, number>>({});
  const [readerChromeVisible, setReaderChromeVisible] = useState(true);
  const [pageTransitionDirection, setPageTransitionDirection] = useState<'forward' | 'backward'>(
    'forward',
  );
  const [keywordProgress, setKeywordProgress] = useState<KeywordLessonProgress>({
    currentIndex: 0,
    completed: false,
  });
  const copy = getUiCopy(language);
  const speakingCopy = getSpeakingCopy(language);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioPageRef = useRef(0);
  const preparedAudioUrlsRef = useRef<string[]>([]);
  const preparationAbortRef = useRef<AbortController | null>(null);
  const startNarrationAfterLearningRef = useRef(false);
  const scrollPositionsRef = useRef<WeakMap<EventTarget, number>>(new WeakMap());
  const readerChromeVisibleRef = useRef(true);
  const readerChromeTransitionLockedUntilRef = useRef(0);
  const restartLearningSessionHandledRef = useRef(false);
  const audioLoader = useMemo(() => {
    if (pageAudioLoader) return pageAudioLoader;
    if (!shareToken) return null;
    return (pageNo: number, signal?: AbortSignal) =>
      fetchSharedStoryPageAudio(shareToken, pageNo, signal);
  }, [pageAudioLoader, shareToken]);

  const updateReaderChromeVisibility = useCallback((visible: boolean) => {
    if (readerChromeVisibleRef.current === visible) return;
    readerChromeVisibleRef.current = visible;
    readerChromeTransitionLockedUntilRef.current = Date.now() + 400;
    setReaderChromeVisible(visible);
  }, []);

  useEffect(() => {
    return () => {
      preparationAbortRef.current?.abort();
      preparedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!initialLearningActive || initialLearningMode !== 'reader' || !learningSessionKey) return;
    if (restartLearningSession) {
      if (!restartLearningSessionHandledRef.current) {
        restartLearningSessionHandledRef.current = true;
        clearSpeakingLearningProgress(learningSessionKey);
        onRestartLearningSessionConsumed?.();
      }
      return;
    }
    restartLearningSessionHandledRef.current = false;
    const saved = loadSpeakingLearningProgress(learningSessionKey);
    if (!saved) return;
    const restoreTimer = window.setTimeout(() => {
      setSpeakingAttempts(saved.attempts);
      setSpeakingSkippedSentenceIds(saved.skippedSentenceIds ?? []);
      setSpeakingSessionId(saved.sessionId);
      if (
        saved.stage === 'speaking' ||
        (saved.stage === 'results' &&
          (saved.attempts.length > 0 || (saved.skippedSentenceIds?.length ?? 0) > 0))
      ) {
        setLearningMode(saved.stage);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [
    initialLearningActive,
    initialLearningMode,
    learningSessionKey,
    onRestartLearningSessionConsumed,
    restartLearningSession,
  ]);

  const handleLanguageChange = (newLang: ReaderLanguage) => {
    setLanguage(newLang);
  };

  const playPreparedPage = useCallback((page: number) => {
    const audio = audioRef.current;
    const audioUrl = preparedAudioUrlsRef.current[page - 1];
    if (!audio || !audioUrl) {
      setNarrationState('error');
      return;
    }

    setNarrationState('loading');
    audioPageRef.current = page;
    audio.src = audioUrl;
    audio.load();
    void audio.play().catch(() => setNarrationState('error'));
  }, []);

  const prepareAndStartNarration = useCallback(async () => {
    if (!audioLoader || story.pages.length === 0) return;

    preparationAbortRef.current?.abort();
    const controller = new AbortController();
    preparationAbortRef.current = controller;
    preparedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    preparedAudioUrlsRef.current = [];
    const preparedUrls: string[] = [];

    setNarrationState('preparing');
    setPreparationProgress({ completed: 0, total: story.pages.length });
    try {
      await prepareNarration?.();
      for (let index = 0; index < story.pages.length; index += 1) {
        const page = story.pages[index];
        const blob = await audioLoader(page.page_no, controller.signal);
        if (controller.signal.aborted) return;
        preparedUrls.push(URL.createObjectURL(blob));
        setPreparationProgress({ completed: index + 1, total: story.pages.length });
      }
      preparedAudioUrlsRef.current = preparedUrls;
      setPageTransitionDirection('forward');
      setCurrentPage(1);
      playPreparedPage(1);
    } catch (error) {
      preparedUrls.forEach((url) => URL.revokeObjectURL(url));
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNarrationState('error');
    }
  }, [audioLoader, playPreparedPage, prepareNarration, story.pages]);

  useEffect(() => {
    if (learningMode !== 'reader' || !startNarrationAfterLearningRef.current) return;
    startNarrationAfterLearningRef.current = false;
    void prepareAndStartNarration();
  }, [learningMode, prepareAndStartNarration]);

  useEffect(() => {
    if (learningMode !== 'reader' || currentPage === 0) {
      updateReaderChromeVisibility(true);
      return;
    }

    const positions = new WeakMap<EventTarget, number>();
    scrollPositionsRef.current = positions;
    positions.set(window, window.scrollY);

    const handleScroll = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null;
      const target: EventTarget = element ?? window;
      const currentPosition = element ? element.scrollTop : window.scrollY;
      const previousPosition = positions.get(target) ?? 0;
      positions.set(target, currentPosition);

      if (Date.now() < readerChromeTransitionLockedUntilRef.current) return;

      if (
        currentPosition < previousPosition - 6 ||
        (currentPosition === 0 && previousPosition > 0)
      ) {
        updateReaderChromeVisibility(true);
      } else if (currentPosition > previousPosition + 6) {
        updateReaderChromeVisibility(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [currentPage, learningMode, updateReaderChromeVisibility]);

  const handlePageChange = useCallback((page: number) => {
    if (narrationState === 'preparing') return;
    const narrationIsActive = narrationState === 'playing' || narrationState === 'loading';
    setPageTransitionDirection(page >= currentPage ? 'forward' : 'backward');
    setCurrentPage(page);
    if (page === 0) {
      audioRef.current?.pause();
      audioPageRef.current = 0;
      setNarrationState('idle');
      return;
    }
    if (narrationIsActive) {
      playPreparedPage(page);
    } else if (narrationState === 'paused') {
      const audio = audioRef.current;
      const audioUrl = preparedAudioUrlsRef.current[page - 1];
      if (audio && audioUrl) {
        audioPageRef.current = page;
        audio.src = audioUrl;
        audio.load();
      }
    }
  }, [currentPage, narrationState, playPreparedPage]);

  const handleNarrationToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioLoader || story.pages.length === 0) return;
    if (narrationState === 'preparing') return;

    if (narrationState === 'playing' || narrationState === 'loading') {
      audio.pause();
      setNarrationState('paused');
      return;
    }
    if (narrationState === 'paused' && audio.src) {
      setNarrationState('loading');
      void audio.play().catch(() => setNarrationState('error'));
      return;
    }

    const hasPreparedAllAudio = preparedAudioUrlsRef.current.length === story.pages.length;
    if (!hasPreparedAllAudio) {
      void prepareAndStartNarration();
      return;
    }

    const pageToPlay = currentPage > 0 && narrationState !== 'finished' ? currentPage : 1;
    if (pageToPlay !== currentPage) setPageTransitionDirection('forward');
    setCurrentPage(pageToPlay);
    playPreparedPage(pageToPlay);
  }, [
    currentPage,
    narrationState,
    playPreparedPage,
    prepareAndStartNarration,
    audioLoader,
    story.pages.length,
  ]);

  const updateListeningProgress = useCallback((page: number, progress: number) => {
    if (page < 1) return;
    const normalized = Math.min(Math.max(progress, 0), 1);
    setListeningProgressByPage((current) => {
      const previous = current[page] ?? 0;
      if (normalized <= previous) return current;
      return { ...current, [page]: normalized };
    });
  }, []);

  const handleNarrationTimeUpdate = useCallback(
    (event: React.SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;
      const page = audioPageRef.current;
      if (page < 1 || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      updateListeningProgress(page, audio.currentTime / audio.duration);
    },
    [updateListeningProgress],
  );

  const handleNarrationEnded = useCallback(() => {
    const completedPage = audioPageRef.current || currentPage;
    updateListeningProgress(completedPage, 1);
    if (completedPage < story.pages.length) {
      const nextPage = completedPage + 1;
      setPageTransitionDirection('forward');
      setCurrentPage(nextPage);
      playPreparedPage(nextPage);
    } else {
      setNarrationState('finished');
    }
  }, [currentPage, playPreparedPage, story.pages.length, updateListeningProgress]);

  const activePage = currentPage > 0 ? story.pages[currentPage - 1] : null;
  const nextImage = currentPage < story.pages.length ? story.pages[currentPage]?.image_url : null;
  const isOnFinalStoryPage = story.pages.length > 0 && currentPage === story.pages.length;
  const storyTitle = language === 'km' ? (story.title_km || '') : (story.title_vi || '');
  const learningContext = story.learning_context;
  const keywordStepProgress = learningContext && learningContext.knowledge.keywords.length > 0
    ? keywordProgress.completed
      ? 1
      : (keywordProgress.currentIndex + 1) / learningContext.knowledge.keywords.length
    : 0;
  const fullyListenedPageCount = story.pages.reduce(
    (count, _page, index) =>
      count + ((listeningProgressByPage[index + 1] ?? 0) >= 1 ? 1 : 0),
    0,
  );
  const listeningStepProgress = story.pages.length > 0
    ? story.pages.reduce(
        (total, _page, index) => total + (listeningProgressByPage[index + 1] ?? 0),
        0,
      ) / story.pages.length
    : 0;

  if (learningMode === 'keywords' && learningContext) {
    return (
      <div className="relative min-h-dvh bg-katha-surface">
        <div className="fixed right-3 top-3 z-[70] rounded-full shadow-xl shadow-black/15 sm:right-5 sm:top-5">
          <ReaderLanguageToggle language={language} onChange={handleLanguageChange} />
        </div>
        <div className="sticky top-0 z-[60] border-b border-katha-text/5 bg-katha-surface/95 px-3 pb-3 pt-3 pr-32 backdrop-blur-md sm:px-6 sm:pr-40">
          <div className="mx-auto max-w-[1400px]">
            <LearningProgressBar
              currentStep={2}
              stepProgress={keywordStepProgress}
              language={language}
            />
          </div>
        </div>
        <KeywordLesson
          className={learningContext.class_name}
          knowledge={learningContext.knowledge}
          language={language}
          initialProgress={keywordProgress}
          onProgressChange={setKeywordProgress}
          onBack={() => setLearningMode('reader')}
          onContinueToStory={() => {
            startNarrationAfterLearningRef.current = true;
            setLearningActive(true);
            setLearningMode('reader');
          }}
        />
        {onResetLearningJourney && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-8 sm:px-6">
            <LearningJourneyControls
              language={language}
              onReset={onResetLearningJourney}
              className="border-t border-katha-text/10 pt-5"
            />
          </div>
        )}
      </div>
    );
  }

  if (learningMode === 'speaking' && learningActive) {
    return (
      <SpeakingPractice
        key={speakingRestartVersion}
        language={language}
        onLanguageChange={handleLanguageChange}
        onBackToStory={() => {
          setLearningMode('reader');
          if (learningSessionKey) {
            saveSpeakingLearningProgress(learningSessionKey, {
              stage: 'reader',
              attempts: speakingAttempts,
              sessionId: speakingSessionId,
              skippedSentenceIds: speakingSkippedSentenceIds,
            });
          }
        }}
        onResetLearningJourney={onResetLearningJourney}
        onComplete={(attempts, sessionId, skippedSentenceIds = []) => {
          setSpeakingAttempts(attempts);
          setSpeakingSkippedSentenceIds(skippedSentenceIds);
          if (sessionId) setSpeakingSessionId(sessionId);
          setLearningMode('results');
          if (learningSessionKey) {
            saveSpeakingLearningProgress(learningSessionKey, {
              stage: 'results',
              attempts,
              sessionId: sessionId ?? speakingSessionId,
              skippedSentenceIds,
            });
          }
        }}
        storyId={speakingStoryId}
        initialAttempts={speakingAttempts}
        initialSessionId={speakingSessionId}
        initialSkippedSentenceIds={speakingSkippedSentenceIds}
        restartSession={speakingRestartVersion > 0}
        onProgressChange={(attempts, sessionId, skippedSentenceIds = []) => {
          setSpeakingAttempts(attempts);
          setSpeakingSkippedSentenceIds(skippedSentenceIds);
          if (sessionId) setSpeakingSessionId(sessionId);
          if (learningSessionKey) {
            saveSpeakingLearningProgress(learningSessionKey, {
              stage: 'speaking',
              attempts,
              sessionId: sessionId ?? speakingSessionId,
              skippedSentenceIds,
            });
          }
        }}
      />
    );
  }

  if (
    learningMode === 'results' &&
    learningActive &&
    (speakingAttempts.length > 0 || speakingSkippedSentenceIds.length > 0)
  ) {
    return (
      <SpeakingResults
        language={language}
        attempts={speakingAttempts}
        skippedCount={speakingSkippedSentenceIds.length}
        keywords={learningContext?.knowledge.keywords ?? []}
        storyPageCount={story.pages.length}
        listenedPageCount={fullyListenedPageCount}
        listeningProgress={listeningStepProgress}
        onLanguageChange={handleLanguageChange}
        onPracticeAgain={() => {
          preparationAbortRef.current?.abort();
          audioRef.current?.pause();
          preparedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
          preparedAudioUrlsRef.current = [];
          startNarrationAfterLearningRef.current = false;
          setCurrentPage(0);
          setNarrationState('idle');
          setPreparationProgress({ completed: 0, total: 0 });
          setListeningProgressByPage({});
          setKeywordProgress({ currentIndex: 0, completed: false });
          setSpeakingAttempts([]);
          setSpeakingSkippedSentenceIds([]);
          setSpeakingSessionId(undefined);
          setSpeakingRestartVersion((version) => version + 1);
          if (learningSessionKey) {
            clearSpeakingLearningProgress(learningSessionKey);
          }
          if (onRestartLearningJourney) {
            onRestartLearningJourney();
            return;
          }
          setLearningActive(true);
          setLearningMode(learningContext ? 'keywords' : 'reader');
        }}
        onReadStoryAgain={() => {
          setCurrentPage(0);
          setNarrationState('idle');
          setLearningMode('reader');
          if (learningSessionKey) {
            saveSpeakingLearningProgress(learningSessionKey, {
              stage: 'reader',
              attempts: speakingAttempts,
              sessionId: speakingSessionId,
              skippedSentenceIds: speakingSkippedSentenceIds,
            });
          }
        }}
        onResetLearningJourney={onResetLearningJourney}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-katha-surface font-sans text-katha-text selection:bg-katha-primary/30 lg:h-dvh lg:overflow-hidden">
      <header
        data-testid="reader-chrome"
        data-expanded={readerChromeVisible}
        className={`sticky top-0 z-40 shrink-0 bg-katha-surface/90 backdrop-blur-md transition-[border-color] duration-300 motion-reduce:transition-none ${
          readerChromeVisible || learningActive
            ? 'border-b border-katha-text/5'
            : 'border-b border-transparent'
        }`}
      >
        <div
          aria-hidden={!readerChromeVisible}
          inert={!readerChromeVisible ? true : undefined}
          className={`grid transition-[grid-template-rows,transform,opacity] duration-300 motion-reduce:transition-none ${
            readerChromeVisible
              ? 'grid-rows-[1fr] translate-y-0 opacity-100'
              : 'pointer-events-none grid-rows-[0fr] -translate-y-full opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <KathaLogo height={34} priority className="-my-1 sm:-my-2" />
                <span className="shrink-0 text-sm font-semibold tracking-wide text-katha-text/85">
                  Katha <span lang="km" className="hidden font-khmer font-normal text-katha-text/55 sm:inline">
                    កថា
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                {currentPage > 0 && audioLoader && (
                  <div className="hidden text-xs text-katha-text/55 sm:block" aria-live="polite">
                    {narrationState === 'playing' && `🔊 ${copy.readingKhmer}`}
                    {narrationState === 'loading' && copy.loadingNarrationPage}
                    {narrationState === 'finished' && copy.storyListeningFinished}
                    {narrationState === 'paused' && copy.narrationPaused}
                    {narrationState === 'error' && copy.narrationFailedRetry}
                  </div>
                )}
                <ReaderLanguageToggle language={language} onChange={handleLanguageChange} />
              </div>
            </div>
          </div>
        </div>
        {learningActive && (
          <div
            className="mx-auto w-full max-w-[1400px] px-3 pb-3 sm:px-6"
          >
            <LearningProgressBar
              currentStep={3}
              stepProgress={listeningStepProgress}
              language={language}
            />
          </div>
        )}
      </header>

      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        aria-label={copy.automaticKhmerReader}
        onPlaying={() => setNarrationState('playing')}
        onWaiting={() => setNarrationState('loading')}
        onTimeUpdate={handleNarrationTimeUpdate}
        onError={() => setNarrationState('error')}
        onEnded={handleNarrationEnded}
      />

      <main className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-4 py-6 transition-opacity duration-300 motion-reduce:transition-none md:px-6 md:py-8 lg:px-8 lg:py-4">
        {narrationState === 'preparing' && (
          <div className="absolute inset-4 z-30 flex items-center justify-center rounded-2xl bg-katha-surface/90 backdrop-blur-md md:inset-6 lg:inset-8">
            <div className="w-full max-w-md rounded-2xl border border-katha-text/10 bg-katha-text/5 p-6 text-center shadow-2xl">
              <KathaLoadingIndicator
                label={copy.loadingKhmerNarration}
                detail={formatCopy(copy.narrationPagesPrepared, {
                  done: preparationProgress.completed,
                  total: preparationProgress.total,
                })}
                progress={preparationProgress.total > 0
                  ? (preparationProgress.completed / preparationProgress.total) * 100
                  : undefined}
                compact
              />
              <p className="mt-3 text-xs text-katha-text/40">
                {copy.storyAutoplaysAfterPreparation}
              </p>
            </div>
          </div>
        )}
        <div
          key={currentPage}
          data-testid="reader-page-transition"
          data-direction={pageTransitionDirection}
          className="katha-reader-page-transition flex min-h-0 w-full flex-1 flex-col"
        >
          {currentPage === 0 ? (
            <StoryCover
              story={story}
              language={language}
            />
          ) : activePage ? (
            <ReaderPage
              page={activePage}
              language={language}
              storyTitle={storyTitle}
              nextImageUrl={nextImage}
              learnedKeywords={
                learningActive ? learningContext?.knowledge.keywords : undefined
              }
            />
          ) : null}
        </div>
      </main>

      {learningActive && isOnFinalStoryPage && (
        <div className="relative z-40 shrink-0 border-t border-katha-text/10 bg-katha-surface/95 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-center">
            <button
              type="button"
              onClick={() => {
                audioRef.current?.pause();
                setLearningMode('speaking');
                if (learningSessionKey) {
                  saveSpeakingLearningProgress(learningSessionKey, {
                    stage: 'speaking',
                    attempts: speakingAttempts,
                    sessionId: speakingSessionId,
                    skippedSentenceIds: speakingSkippedSentenceIds,
                  });
                }
              }}
              className="katha-speaking-cta relative min-h-11 cursor-pointer rounded-xl bg-katha-primary px-6 text-sm font-bold text-katha-text"
            >
              {speakingCopy.continueSpeaking} →
            </button>
          </div>
        </div>
      )}

      {learningActive && onResetLearningJourney && (
        <div className="relative z-40 shrink-0 border-t border-katha-text/10 bg-katha-surface/95 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <LearningJourneyControls
              language={language}
              onReset={onResetLearningJourney}
              disabled={narrationState === 'preparing'}
            />
          </div>
        </div>
      )}

      <ReaderControls 
        currentPage={currentPage}
        totalPages={story.pages.length}
        onPageChange={handlePageChange}
        narrationState={narrationState}
        canNarrate={Boolean(audioLoader && story.pages.length)}
        onNarrationToggle={handleNarrationToggle}
        navigationDisabled={narrationState === 'preparing'}
        language={language}
      />
    </div>
  );
}
