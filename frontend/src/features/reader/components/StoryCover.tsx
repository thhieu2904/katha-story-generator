import React from 'react';
import type { PublicStory, ReaderLanguage } from '../types';

interface StoryCoverProps {
  story: PublicStory;
  language: ReaderLanguage;
}

export function StoryCover({ story, language }: StoryCoverProps) {
  const bgUrl = story.cover.background_url || story.pages[0]?.image_url;
  
  return (
    <div className="relative w-full aspect-auto min-h-[60vh] flex flex-col justify-end bg-gradient-to-b from-katha-surface to-black/80 rounded-xl overflow-hidden">
      {bgUrl ? (
        <img
          src={bgUrl}
          alt="Bìa truyện"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900" />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      
      <div className="relative z-10 p-6 md:p-8 space-y-4">
        {language === 'km' ? (
          <>
            <h1 lang="km" className="font-khmer text-3xl md:text-5xl text-white font-bold leading-tight">
              {story.title_km || 'ចំណងជើង'}
            </h1>
            <p lang="vi" className="text-gray-300 text-lg md:text-xl">
              {story.title_vi || 'Tiêu đề'}
            </p>
          </>
        ) : (
          <>
            <h1 lang="vi" className="text-3xl md:text-5xl text-white font-bold leading-tight">
              {story.title_vi || 'Tiêu đề'}
            </h1>
            <p lang="km" className="font-khmer text-gray-300 text-lg md:text-xl">
              {story.title_km || 'ចំណងជើង'}
            </p>
          </>
        )}
        
        <div className="inline-flex items-center px-3 py-1 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
          <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
            Bìa
          </span>
        </div>
      </div>
    </div>
  );
}
