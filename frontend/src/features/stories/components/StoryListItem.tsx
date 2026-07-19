'use client';

import Link from 'next/link';
import type { StoryListItem as StoryListItemType } from '../types';
import { STATUS_LABELS, TARGET_AGE_LABELS, LENGTH_LABELS } from '../constants';
import { ArchiveStoryDialog } from './ArchiveStoryDialog';
import { useState } from 'react';

interface StoryListItemProps {
  story: StoryListItemType;
  onArchiveSuccess: () => void;
}

export function StoryListItem({ story, onArchiveSuccess }: StoryListItemProps) {
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const title = story.title_vi || 'Truyện chưa đặt tên';
  const ageLabel = story.target_age ? TARGET_AGE_LABELS[story.target_age] : 'Chưa rõ';
  const lengthLabel = story.length_pref ? LENGTH_LABELS[story.length_pref] : 'Chưa rõ';
  const statusLabel = STATUS_LABELS[story.status] || story.status;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
      case 'generating_text':
        return 'bg-violet-500/15 text-violet-300 border-violet-500/20';
      case 'text_draft':
      case 'text_confirmed':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/20';
      case 'generating_images':
      case 'pending_review':
        return 'bg-katha-primary/15 text-katha-primary-light border-katha-primary/20';
      case 'approved':
      case 'published':
        return 'bg-katha-success/15 text-emerald-300 border-katha-success/20';
      case 'archived':
        return 'bg-slate-500/15 text-slate-300 border-slate-500/20';
      default:
        return 'bg-white/10 text-white/70 border-white/10';
    }
  };

  const formattedDate = story.created_at
    ? new Date(story.created_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <>
      <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055] overflow-hidden">
        <div className="flex-1 p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg leading-tight line-clamp-1">{title}</h3>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getStatusColor(story.status)}`}>
              {statusLabel}
            </span>
          </div>

          <p className="text-sm text-white/60 line-clamp-2 min-h-[2.5rem]">
            {story.description_vi || 'Chưa có mô tả'}
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-white/45">
            <span className="rounded-md bg-white/[0.06] px-2 py-1">
              Tuổi: {ageLabel}
            </span>
            <span className="rounded-md bg-white/[0.06] px-2 py-1">
              Độ dài: {lengthLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 p-4 bg-black/20">
          <span className="text-xs text-white/40">{formattedDate}</span>

          <div className="flex gap-2">
            {story.status === 'draft' ? (
              <>
                <button
                  onClick={() => setIsArchiveDialogOpen(true)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  Lưu trữ
                </button>
                <Link
                  href={`/admin/stories/${story.id}/setup`}
                  className="rounded-lg bg-katha-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-katha-primary-light"
                >
                  Tiếp tục thiết lập
                </Link>
              </>
            ) : story.status !== 'archived' ? (
              <Link
                href={`/admin/stories/${story.id}/edit`}
                className="rounded-lg bg-katha-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-katha-primary-light"
              >
                {story.status === 'generating_text' ? 'Xem tiến trình' : 'Xem nội dung'}
              </Link>
            ) : (
              <span className="text-xs text-white/50">{statusLabel}</span>
            )}
          </div>
        </div>
      </div>

      {isArchiveDialogOpen && (
        <ArchiveStoryDialog
          storyId={story.id}
          storyTitle={title}
          onClose={() => setIsArchiveDialogOpen(false)}
          onSuccess={() => {
            setIsArchiveDialogOpen(false);
            onArchiveSuccess();
          }}
        />
      )}
    </>
  );
}
