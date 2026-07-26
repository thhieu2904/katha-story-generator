import React, { useState } from 'react';
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
  const [language, setLanguage] = useState<ReaderLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('katha-reader-lang');
      if (saved === 'km' || saved === 'vi') return saved;
    }
    return 'km';
  });

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
    <div className="min-h-screen bg-katha-surface text-gray-100 flex flex-col font-sans selection:bg-katha-primary/30">
      <header className="absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/50 to-transparent">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <KathaLogo height={42} priority className="-my-2" />
            <span className="shrink-0 text-sm font-semibold tracking-wide text-white/85">
              Katha{' '}
              <span lang="km" className="font-khmer font-normal text-white/55">
                កថា
              </span>
            </span>
            {currentPage > 0 && storyTitle && (
              <>
                <span className="hidden text-white/25 sm:inline" aria-hidden>
                  ·
                </span>
                <span
                  lang={language}
                  className={`hidden truncate text-sm text-white/60 sm:inline ${
                    language === 'km' ? 'font-khmer' : ''
                  }`}
                >
                  {storyTitle}
                </span>
              </>
            )}
          </div>
          <ReaderLanguageToggle language={language} onChange={handleLanguageChange} />
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pb-4 pt-20 md:px-6 lg:px-8 flex flex-col justify-center transition-opacity duration-300 motion-reduce:transition-none">
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
