import React from 'react';
import Head from 'next/head';
import type { PublicPage, ReaderLanguage } from '../types';

interface ReaderPageProps {
  page: PublicPage;
  language: ReaderLanguage;
  storyTitle: string;
  nextImageUrl?: string | null;
}

export function ReaderPage({ page, language, storyTitle, nextImageUrl }: ReaderPageProps) {
  return (
    <article className="w-full flex flex-col items-center">
      <h2 className="sr-only">Trang {page.page_no}</h2>
      
      {nextImageUrl && (
        <Head>
          <link rel="preload" as="image" href={nextImageUrl} />
        </Head>
      )}

      <div className="w-full max-w-2xl mx-auto mb-8 rounded-xl overflow-hidden bg-black/20">
        <div className="relative w-full aspect-video flex items-center justify-center">
          {page.image_url ? (
            <img
              src={page.image_url}
              alt={`Minh họa trang ${page.page_no} của ${storyTitle}`}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10" />
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 md:px-0">
        {language === 'km' ? (
          <p 
            lang="km" 
            className="font-khmer text-[22px] md:text-[26px] leading-[1.8] text-gray-100 text-center"
          >
            {page.text_km}
          </p>
        ) : (
          <p 
            lang="vi" 
            className="text-lg md:text-xl leading-relaxed text-gray-100 text-center"
          >
            {page.text_vi}
          </p>
        )}
      </div>
    </article>
  );
}
