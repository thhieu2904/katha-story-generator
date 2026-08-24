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

      <h3
        lang={language}
        className={`shrink-0 text-center text-lg font-semibold text-katha-text/80 md:text-xl lg:text-left ${language === 'km' ? 'font-khmer' : ''}`}
      >
        {storyTitle}
      </h3>

      <div className="relative mx-auto flex w-full max-w-[896px] items-center justify-center lg:min-h-0 lg:max-w-none lg:flex-[3]">
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
            className="relative w-full h-auto rounded-xl lg:h-full lg:w-auto lg:max-w-full"
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full rounded-xl bg-[url('/pattern.svg')] opacity-10" />
        )}
      </div>

      <div className="mx-auto w-full max-w-[896px] lg:min-h-0 lg:max-w-none lg:flex-1 lg:overflow-y-auto lg:px-4">
        {language === 'km' ? (
          <p
            lang="km"
            className="text-center font-khmer-serif text-[22px] leading-[2] text-katha-text md:text-[26px] lg:text-left"
          >
            {page.text_km}
          </p>
        ) : (
          <p 
            lang="vi" 
            className="text-center text-lg leading-relaxed text-katha-text md:text-xl lg:text-left"
          >
            {page.text_vi}
          </p>
        )}

      </div>
    </article>
  );
}
