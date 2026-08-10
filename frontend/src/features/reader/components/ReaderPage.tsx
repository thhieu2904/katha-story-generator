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
    <article className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] xl:gap-8">
      <h2 className="sr-only">Trang {page.page_no}</h2>
      
      {nextImageUrl && (
        <Head>
          <link rel="preload" as="image" href={nextImageUrl} />
        </Head>
      )}

      <div className="mx-auto w-full max-w-[896px] overflow-hidden rounded-xl bg-black/20 xl:mx-0 xl:max-w-none">
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

      <div className="mx-auto w-full max-w-prose xl:max-w-[34rem] xl:justify-self-center">
        {language === 'km' ? (
          <p
            lang="km"
            className="text-center font-khmer-serif text-[22px] leading-[2] text-gray-100 md:text-[26px] xl:text-left"
          >
            {page.text_km}
          </p>
        ) : (
          <p 
            lang="vi" 
            className="text-center text-lg leading-relaxed text-gray-100 md:text-xl xl:text-left"
          >
            {page.text_vi}
          </p>
        )}
      </div>
    </article>
  );
}
