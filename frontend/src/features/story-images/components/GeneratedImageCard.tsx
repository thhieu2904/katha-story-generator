'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  IMAGE_PAGE_ERROR_LABELS,
  IMAGE_PAGE_STATUS_LABELS,
} from '../constants';
import type { StoryImagePage } from '../types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-white/15 bg-white/[0.045] text-white/55',
  generating: 'border-katha-primary/30 bg-katha-primary/10 text-katha-primary-light',
  completed: 'border-katha-success/30 bg-katha-success/10 text-emerald-200',
  failed: 'border-katha-error/30 bg-katha-error/10 text-red-200',
};

function ImageFallback({ page }: { page: StoryImagePage }) {
  const error = page.image_error_code
    ? IMAGE_PAGE_ERROR_LABELS[page.image_error_code] || 'Không thể hiển thị ảnh của trang này.'
    : null;

  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-white/[0.06] to-black/25 p-5 text-center text-white/40">
      <div>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="mx-auto h-10 w-10">
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.3" />
          <path d="m5.5 17 4.5-4.5 3 2.8 2.2-2 3.3 3.7" />
        </svg>
        <p className="mt-2 text-xs font-medium text-white/60">
          {page.image_status === 'completed' ? 'Không thể tải ảnh minh họa' : IMAGE_PAGE_STATUS_LABELS[page.image_status]}
        </p>
        {error && <p className="mx-auto mt-1 max-w-xs text-[11px] leading-4 text-red-200/75">{error}</p>}
      </div>
    </div>
  );
}

export function GeneratedImageCard({ page }: { page: StoryImagePage }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = page.image_url?.trim() || null;
  const hasImage = Boolean(imageUrl && imageUrl !== failedImageUrl);
  const statusLabel = IMAGE_PAGE_STATUS_LABELS[page.image_status] || page.image_status;

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="relative aspect-video overflow-hidden">
        {hasImage ? (
          <Image
            src={imageUrl as string}
            alt={`Minh họa trang ${page.page_no}`}
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 42vw"
            onError={() => setFailedImageUrl(imageUrl)}
            className="object-cover"
          />
        ) : (
          <ImageFallback page={page} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5">
        <span className="text-xs font-medium text-white/70">Minh họa trang {page.page_no}</span>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${STATUS_STYLES[page.image_status] || STATUS_STYLES.pending}`}>
          {statusLabel}
        </span>
      </div>
    </section>
  );
}
