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
    <article className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:h-full lg:min-h-0 lg:gap-4">
      <h2 className="sr-only">Trang {page.page_no}</h2>
      
      {nextImageUrl && (
        <Head>
          <link rel="preload" as="image" href={nextImageUrl} />
        </Head>
      )}

      <div className="mx-auto w-full max-w-[896px] overflow-hidden lg:min-h-0 lg:max-w-none lg:flex-[3]">
        <div className="relative flex w-full aspect-video items-center justify-center lg:h-full lg:aspect-auto">
          {page.image_url && (
            <div
              aria-hidden="true"
              className="absolute inset-0 hidden scale-110 bg-cover bg-center opacity-30 blur-2xl lg:block"
              style={{ backgroundImage: `url(${page.image_url})` }}
            />
          )}
          {page.image_url ? (
            <img
              src={page.image_url}
              alt={`Minh họa trang ${page.page_no} của ${storyTitle}`}
              className="relative h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10" />
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[896px] lg:min-h-0 lg:max-w-none lg:flex-1 lg:overflow-y-auto lg:px-4">
        {language === 'km' ? (
          <p
            lang="km"
            className="text-center font-khmer-serif text-[22px] leading-[2] text-gray-100 md:text-[26px] lg:text-left"
          >
            {page.text_km}
          </p>
        ) : (
          <p 
            lang="vi" 
            className="text-center text-lg leading-relaxed text-gray-100 md:text-xl lg:text-left"
          >
            {page.text_vi}
          </p>
        )}
      </div>
    </article>
  );
}
