import React, { useEffect, useState } from 'react';
import type { PublicStory, ReaderLanguage } from '../types';
import { StoryCover } from './StoryCover';
import { ReaderPage } from './ReaderPage';
import { ReaderControls } from './ReaderControls';
import { ReaderLanguageToggle } from './ReaderLanguageToggle';
import { KathaLogo } from '@/components/layout/KathaLogo';

interface StoryReaderProps {
  story: PublicStory;
}

export function StoryReader({ story }: StoryReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [language, setLanguage] = useState<ReaderLanguage>('km');

  useEffect(() => {
    const saved = localStorage.getItem('katha-reader-lang');
    if (saved === 'km' || saved === 'vi') {
      const restoreLanguage = window.setTimeout(() => setLanguage(saved), 0);
      return () => window.clearTimeout(restoreLanguage);
    }
  }, []);

  const handleLanguageChange = (newLang: ReaderLanguage) => {
    setLanguage(newLang);
    localStorage.setItem('katha-reader-lang', newLang);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activePage = currentPage > 0 ? story.pages[currentPage - 1] : null;
  const nextImage = currentPage < story.pages.length ? story.pages[currentPage]?.image_url : null;
  const storyTitle = language === 'km' ? (story.title_km || '') : (story.title_vi || '');

  return (
    <div className="flex min-h-dvh flex-col bg-katha-surface font-sans text-gray-100 selection:bg-katha-primary/30 lg:h-dvh lg:overflow-hidden">
      <header className="sticky top-0 z-40 shrink-0 border-b border-white/5 bg-katha-surface/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <KathaLogo height={34} priority className="-my-1 sm:-my-2" />
            <span className="shrink-0 text-sm font-semibold tracking-wide text-white/85">
              Katha <span lang="km" className="hidden font-khmer font-normal text-white/55 sm:inline">
                កថា
              </span>
            </span>
          </div>
          <ReaderLanguageToggle language={language} onChange={handleLanguageChange} />
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-4 py-6 transition-opacity duration-300 motion-reduce:transition-none md:px-6 md:py-8 lg:px-8 lg:py-4">
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
      />
    </div>
  );
}
