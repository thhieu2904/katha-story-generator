import React, { useState, useEffect } from 'react';
import type { PublicStory, ReaderLanguage } from '../types';
import { StoryCover } from './StoryCover';
import { ReaderPage } from './ReaderPage';
import { ReaderControls } from './ReaderControls';
import { ReaderLanguageToggle } from './ReaderLanguageToggle';

interface StoryReaderProps {
  story: PublicStory;
}

export function StoryReader({ story }: StoryReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [language, setLanguage] = useState<ReaderLanguage>('km');

  useEffect(() => {
    const saved = localStorage.getItem('katha-reader-lang');
    if (saved === 'km' || saved === 'vi') {
      setLanguage(saved);
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
    <div className="min-h-screen bg-katha-surface text-gray-100 flex flex-col font-sans selection:bg-katha-primary/30">
      <header className="sticky top-0 z-40 bg-katha-surface/80 backdrop-blur-sm border-b border-white/5 py-3 px-4">
        <ReaderLanguageToggle language={language} onChange={handleLanguageChange} />
      </header>
      
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col justify-center transition-opacity duration-300 motion-reduce:transition-none">
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
