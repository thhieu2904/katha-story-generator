import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicStory, ReaderLanguage } from '../types';
import { StoryCover } from './StoryCover';
import { ReaderPage } from './ReaderPage';
import { ReaderControls } from './ReaderControls';
import { ReaderLanguageToggle } from './ReaderLanguageToggle';
import { KathaLogo } from '@/components/layout/KathaLogo';
import { fetchSharedStoryPageAudio } from '../api';

interface StoryReaderProps {
  story: PublicStory;
  shareToken?: string;
}

export function StoryReader({ story, shareToken }: StoryReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [language, setLanguage] = useState<ReaderLanguage>('km');
  const [narrationState, setNarrationState] = useState<
    'idle' | 'preparing' | 'loading' | 'playing' | 'paused' | 'finished' | 'error'
  >('idle');
  const [preparationProgress, setPreparationProgress] = useState({ completed: 0, total: 0 });
  const audioRef = useRef<HTMLAudioElement>(null);
  const preparedAudioUrlsRef = useRef<string[]>([]);
  const preparationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('katha-reader-lang');
    if (saved === 'km' || saved === 'vi') {
      const restoreLanguage = window.setTimeout(() => setLanguage(saved), 0);
      return () => window.clearTimeout(restoreLanguage);
    }
  }, []);

  useEffect(() => {
    return () => {
      preparationAbortRef.current?.abort();
      preparedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleLanguageChange = (newLang: ReaderLanguage) => {
    setLanguage(newLang);
    localStorage.setItem('katha-reader-lang', newLang);
  };

  const playPreparedPage = useCallback((page: number) => {
    const audio = audioRef.current;
    const audioUrl = preparedAudioUrlsRef.current[page - 1];
    if (!audio || !audioUrl) {
      setNarrationState('error');
      return;
    }

    setNarrationState('loading');
    audio.src = audioUrl;
    audio.load();
    void audio.play().catch(() => setNarrationState('error'));
  }, []);

  const prepareAndStartNarration = useCallback(async () => {
    if (!shareToken || story.pages.length === 0) return;

    preparationAbortRef.current?.abort();
    const controller = new AbortController();
    preparationAbortRef.current = controller;
    preparedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    preparedAudioUrlsRef.current = [];
    const preparedUrls: string[] = [];

    setNarrationState('preparing');
    setPreparationProgress({ completed: 0, total: story.pages.length });
    try {
      for (let index = 0; index < story.pages.length; index += 1) {
        const page = story.pages[index];
        const blob = await fetchSharedStoryPageAudio(shareToken, page.page_no, controller.signal);
        if (controller.signal.aborted) return;
        preparedUrls.push(URL.createObjectURL(blob));
        setPreparationProgress({ completed: index + 1, total: story.pages.length });
      }
      preparedAudioUrlsRef.current = preparedUrls;
      setCurrentPage(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      playPreparedPage(1);
    } catch (error) {
      preparedUrls.forEach((url) => URL.revokeObjectURL(url));
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNarrationState('error');
    }
  }, [playPreparedPage, shareToken, story.pages]);

  const handlePageChange = useCallback((page: number) => {
    if (narrationState === 'preparing') return;
    const narrationIsActive = narrationState === 'playing' || narrationState === 'loading';
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 0) {
      audioRef.current?.pause();
      setNarrationState('idle');
      return;
    }
    if (narrationIsActive) {
      playPreparedPage(page);
    } else if (narrationState === 'paused') {
      const audio = audioRef.current;
      const audioUrl = preparedAudioUrlsRef.current[page - 1];
      if (audio && audioUrl) {
        audio.src = audioUrl;
        audio.load();
      }
    }
  }, [narrationState, playPreparedPage]);

  const handleNarrationToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !shareToken || story.pages.length === 0) return;
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
    setCurrentPage(pageToPlay);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    playPreparedPage(pageToPlay);
  }, [
    currentPage,
    narrationState,
    playPreparedPage,
    prepareAndStartNarration,
    shareToken,
    story.pages.length,
  ]);

  const handleNarrationEnded = useCallback(() => {
    if (currentPage < story.pages.length) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      playPreparedPage(nextPage);
    } else {
      setNarrationState('finished');
    }
  }, [currentPage, playPreparedPage, story.pages.length]);

  const activePage = currentPage > 0 ? story.pages[currentPage - 1] : null;
  const nextImage = currentPage < story.pages.length ? story.pages[currentPage]?.image_url : null;
  const storyTitle = language === 'km' ? (story.title_km || '') : (story.title_vi || '');

  return (
    <div className="flex min-h-dvh flex-col bg-katha-surface font-sans text-katha-text selection:bg-katha-primary/30 lg:h-dvh lg:overflow-hidden">
      <header className="sticky top-0 z-40 shrink-0 border-b border-katha-text/5 bg-katha-surface/90 backdrop-blur-md">
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
            {currentPage > 0 && shareToken && (
              <div className="hidden text-xs text-katha-text/55 sm:block" aria-live="polite">
                {narrationState === 'playing' && '🔊 Đang đọc tiếng Khmer'}
                {narrationState === 'loading' && 'Đang tải trang đọc…'}
                {narrationState === 'finished' && 'Đã nghe hết truyện'}
                {narrationState === 'paused' && 'Đã tạm dừng'}
                {narrationState === 'error' && 'Không phát được — bấm Play để thử lại'}
              </div>
            )}
            <ReaderLanguageToggle language={language} onChange={handleLanguageChange} />
          </div>
        </div>
      </header>

      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        aria-label="Trình đọc truyện Khmer tự động"
        onPlaying={() => setNarrationState('playing')}
        onWaiting={() => setNarrationState('loading')}
        onError={() => setNarrationState('error')}
        onEnded={handleNarrationEnded}
      />

      <main className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-4 py-6 transition-opacity duration-300 motion-reduce:transition-none md:px-6 md:py-8 lg:px-8 lg:py-4">
        {narrationState === 'preparing' && (
          <div className="absolute inset-4 z-30 flex items-center justify-center rounded-2xl bg-katha-surface/90 backdrop-blur-md md:inset-6 lg:inset-8">
            <div className="w-full max-w-md rounded-2xl border border-katha-text/10 bg-katha-text/5 p-6 text-center shadow-2xl" role="status" aria-live="polite">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-katha-text/15 border-t-katha-primary" />
              <h2 className="text-lg font-semibold text-katha-text">Đang tải giọng đọc Khmer</h2>
              <p className="mt-2 text-sm text-katha-text/55">
                Đã xong {preparationProgress.completed}/{preparationProgress.total} trang
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-katha-text/10">
                <div
                  className="h-full rounded-full bg-katha-primary transition-[width] duration-300"
                  style={{
                    width: `${preparationProgress.total > 0
                      ? Math.round((preparationProgress.completed / preparationProgress.total) * 100)
                      : 0}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-katha-text/40">
                Truyện sẽ tự phát khi tải đủ tất cả các trang.
              </p>
            </div>
          </div>
        )}
        {currentPage === 0 ? (
          <StoryCover story={story} language={language} />
        ) : activePage ? (
          <ReaderPage 
            page={activePage} 
            language={language} 
            storyTitle={storyTitle}
            nextImageUrl={nextImage}
          />
        ) : null}
      </main>

      <ReaderControls 
        currentPage={currentPage}
        totalPages={story.pages.length}
        onPageChange={handlePageChange}
        narrationState={narrationState}
        canNarrate={Boolean(shareToken && story.pages.length)}
        onNarrationToggle={handleNarrationToggle}
        navigationDisabled={narrationState === 'preparing'}
      />
    </div>
  );
}
