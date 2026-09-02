import React from 'react';
import Head from 'next/head';
import { formatCopy, getUiCopy } from '@/features/language/uiCopy';
import type { KhmerKeyword } from '@/features/vision/api';
import type { PublicPage, ReaderLanguage } from '../types';
import { HighlightedLearningText } from './HighlightedLearningText';

interface ReaderPageProps {
  page: PublicPage;
  language: ReaderLanguage;
  storyTitle: string;
  nextImageUrl?: string | null;
  learnedKeywords?: KhmerKeyword[];
}

export function ReaderPage({
  page,
  language,
  storyTitle,
  nextImageUrl,
  learnedKeywords = [],
}: ReaderPageProps) {
  const copy = getUiCopy(language);
  return (
    <article className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 lg:h-full lg:min-h-0 lg:gap-2">
      <h2 className="sr-only">{formatCopy(copy.pageLabel, { page: page.page_no })}</h2>
      
      {nextImageUrl && (
        <Head>
          <link rel="preload" as="image" href={nextImageUrl} />
        </Head>
      )}

      <h3
        lang={language}
        className={`shrink-0 text-center text-base font-semibold text-katha-text/80 md:text-lg lg:text-left ${language === 'km' ? 'font-khmer' : ''}`}
      >
        {storyTitle}
      </h3>

      <div className="relative mx-auto flex w-full max-w-[1040px] items-center justify-center lg:min-h-0 lg:max-w-none lg:flex-1">
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
            alt={formatCopy(copy.pageIllustrationAlt, { page: page.page_no, title: storyTitle })}
            className="relative h-auto w-full rounded-xl object-contain lg:h-full lg:w-full lg:max-w-full"
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full rounded-xl bg-[url('/pattern.svg')] opacity-10" />
        )}
      </div>

      <div className="mx-auto w-full max-w-[1040px] space-y-2 lg:max-h-28 lg:min-h-0 lg:max-w-none lg:flex-none lg:overflow-y-auto lg:px-4">
        <p
          data-testid="reader-primary-text"
          lang={language}
          className={`text-center text-katha-text lg:text-left ${
            language === 'km'
              ? 'font-khmer-serif text-xl leading-[1.8] md:text-[22px]'
              : 'text-base leading-relaxed md:text-lg'
          }`}
        >
          <HighlightedLearningText
            text={language === 'km' ? page.text_km : page.text_vi}
            keywords={learnedKeywords}
            language={language}
          />
        </p>

        <p
          data-testid="reader-secondary-text"
          lang={language === 'km' ? 'vi' : 'km'}
          className={`border-t border-katha-text/10 pt-2 text-center text-katha-text/60 lg:text-left ${
            language === 'km'
              ? 'text-xs leading-relaxed md:text-sm'
              : 'font-khmer-serif text-base leading-[1.7] md:text-lg'
          }`}
        >
          <HighlightedLearningText
            text={language === 'km' ? page.text_vi : page.text_km}
            keywords={learnedKeywords}
            language={language === 'km' ? 'vi' : 'km'}
          />
        </p>
      </div>
    </article>
  );
}
