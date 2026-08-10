import React from 'react';
import type { PublicStory, ReaderLanguage } from '../types';

interface StoryCoverProps {
  story: PublicStory;
  language: ReaderLanguage;
}

export function StoryCover({ story, language }: StoryCoverProps) {
  const bgUrl = story.cover.background_url || story.pages[0]?.image_url;
  const primaryTitle = language === 'km' ? story.title_km || 'ចំណងជើង' : story.title_vi || 'Tiêu đề';
  const secondaryTitle = language === 'km' ? story.title_vi || 'Tiêu đề' : story.title_km || 'ចំណងជើង';
  
  return (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-katha-surface-light shadow-2xl shadow-black/20 lg:h-full lg:min-h-0">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-indigo-950 via-katha-surface to-purple-950 lg:min-h-0 lg:flex-[3] lg:aspect-auto">
        {bgUrl && (
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden scale-110 bg-cover bg-center opacity-30 blur-2xl lg:block"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
        )}
        {bgUrl ? (
          <img
            src={bgUrl}
            alt={`Bìa truyện: ${primaryTitle}`}
            className="relative h-full w-full object-contain"
          />
        ) : (
          <div
            role="img"
            aria-label="Chưa có ảnh bìa truyện"
            className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-katha-surface to-purple-900"
          />
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-6 md:p-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-5">
        {language === 'km' ? (
          <>
            <h1 lang="km" className="font-khmer-serif text-3xl font-bold leading-snug text-white sm:text-4xl md:text-5xl">
              {primaryTitle}
            </h1>
            <p lang="vi" className="text-base text-gray-300 sm:text-lg md:text-xl">
              {secondaryTitle}
            </p>
          </>
        ) : (
          <>
            <h1 lang="vi" className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              {primaryTitle}
            </h1>
            <p lang="km" className="font-khmer-serif text-base text-gray-300 sm:text-lg md:text-xl">
              {secondaryTitle}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
