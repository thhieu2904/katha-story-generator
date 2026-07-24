import React from 'react';
import type { StoryImagePage } from '../types';
import { GeneratedImageCard } from './GeneratedImageCard';

interface ImagePageProgressGridProps {
  pages: StoryImagePage[];
}

export function ImagePageProgressGrid({ pages }: ImagePageProgressGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Tiến độ từng trang</h3>
        <span className="text-xs text-white/50">{pages.length} trang</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map((page) => {
          const status = page.image_status;
          const isGenerating = status === 'generating';
          const isCompleted = status === 'completed';
          const isFailed = status === 'failed';

          return (
            <div
              key={page.id}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                isGenerating
                  ? 'border-katha-primary bg-katha-primary/10 ring-2 ring-katha-primary/50 shadow-lg shadow-katha-primary/20'
                  : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : isFailed
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white">
                  Trang {page.page_no}
                </span>
                <span
                  role="status"
                  aria-live="polite"
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    isGenerating
                      ? 'bg-katha-primary text-white animate-pulse'
                      : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : isFailed
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-white/10 text-white/50'
                  }`}
                >
                  {isGenerating
                    ? 'Trang ' + page.page_no + ' · Đang tạo'
                    : isCompleted
                      ? 'Hoàn tất'
                      : isFailed
                        ? 'Cần thử lại'
                        : 'Đang chờ'}
                </span>
              </div>

              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/40 relative">
                {isCompleted ? (
                  <GeneratedImageCard page={page} />
                ) : isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                    <div className="h-8 w-8 rounded-full border-2 border-katha-primary border-t-transparent animate-spin" />
                    <span className="text-xs text-katha-primary-light font-medium">
                      Đang sinh ảnh AI…
                    </span>
                  </div>
                ) : isFailed ? (
                  <div className="flex flex-col items-center justify-center h-full gap-1 p-4 text-center">
                    <span className="text-lg">⚠️</span>
                    <span className="text-xs text-rose-300">Không thể tạo ảnh</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <span className="text-xs text-white/30">Chờ tới lượt</span>
                  </div>
                )}
              </div>

              {(page.image_scene_en || page.text_vi) && (
                <p className="mt-3 text-xs text-white/60 line-clamp-2">
                  {page.image_scene_en || page.text_vi}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
