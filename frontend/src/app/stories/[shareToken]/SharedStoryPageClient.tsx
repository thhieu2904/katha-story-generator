'use client';

import React from 'react';
import { usePublicStory } from '@/features/reader/usePublicStory';
import { StoryReader } from '@/features/reader/components/StoryReader';

export function SharedStoryPageClient({ shareToken }: { shareToken: string }) {
  const { story, loading, error, notFound } = usePublicStory(shareToken);

  if (loading) {
    return (
      <div className="min-h-screen bg-katha-surface flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-katha-primary border-t-transparent animate-spin" />
          <p className="text-katha-text/55">Đang tải truyện...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-katha-surface flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto bg-katha-text/5 rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-katha-text/55">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-katha-text">Không tìm thấy truyện</h1>
          <p className="text-katha-text/55">Truyện này không tồn tại hoặc đã bị gỡ bỏ.</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-katha-surface flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-katha-text">Không thể tải truyện</h1>
          <p className="text-katha-text/55">{error || 'Đã xảy ra lỗi không xác định.'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-katha-text/10 hover:bg-katha-text/20 rounded-full text-katha-text transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return <StoryReader story={story} shareToken={shareToken} />;
}
