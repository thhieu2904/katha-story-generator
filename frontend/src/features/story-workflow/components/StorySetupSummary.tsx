import React from 'react';
import type { Story } from '@/features/stories/types';

interface StorySetupSummaryProps {
  story: Story;
  characters?: Array<{ id: number; name: string; avatar_url?: string | null }>;
  backboneName?: string;
  genreName?: string;
  artStyleName?: string;
}

export function StorySetupSummary({
  story,
  characters = [],
  backboneName,
  genreName,
  artStyleName,
}: StorySetupSummaryProps) {
  return (
    <div className="rounded-2xl border border-katha-text/10 bg-katha-surface/40 p-6 backdrop-blur-sm space-y-6">
      <div className="flex items-center justify-between border-b border-katha-text/10 pb-4">
        <h2 className="text-lg font-medium text-katha-text">Thiết lập ban đầu</h2>
        <span className="rounded-full bg-katha-success/20 px-3 py-1 text-xs font-semibold text-katha-success">
          Đã khóa thiết lập
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-katha-text/50">
          Ý tưởng câu chuyện
        </h3>
        <p className="text-sm text-katha-text/90 leading-relaxed whitespace-pre-wrap">
          {story.description_vi || 'Chưa có mô tả.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        <div className="rounded-xl border border-katha-text/5 bg-katha-text/5 p-3">
          <span className="block text-xs text-katha-text/50">Cốt truyện (Backbone)</span>
          <span className="text-sm font-medium text-katha-text">
            {backboneName || `#${story.backbone_id}`}
          </span>
        </div>

        <div className="rounded-xl border border-katha-text/5 bg-katha-text/5 p-3">
          <span className="block text-xs text-katha-text/50">Thể loại (Genre)</span>
          <span className="text-sm font-medium text-katha-text">
            {genreName || `#${story.genre_id}`}
          </span>
        </div>

        <div className="rounded-xl border border-katha-text/5 bg-katha-text/5 p-3">
          <span className="block text-xs text-katha-text/50">Phong cách nghệ thuật</span>
          <span className="text-sm font-medium text-katha-text">
            {artStyleName || `#${story.art_style_id}`}
          </span>
        </div>

        <div className="rounded-xl border border-katha-text/5 bg-katha-text/5 p-3">
          <span className="block text-xs text-katha-text/50">Độ tuổi & Độ dài</span>
          <span className="text-sm font-medium text-katha-text">
            {story.target_age || '—'} · {story.length_pref || '—'}
          </span>
        </div>
      </div>

      {characters.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-katha-text/50">
            Nhân vật xuất hiện
          </h3>
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-katha-text/10 bg-katha-text/5 px-3 py-1.5 text-xs text-katha-text"
              >
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
