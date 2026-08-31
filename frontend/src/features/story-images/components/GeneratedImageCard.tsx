'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  IMAGE_PAGE_ERROR_LABELS,
} from '../constants';
import type { StoryImagePage } from '../types';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-katha-text/15 bg-katha-text/[0.045] text-katha-text/55',
  generating: 'border-katha-primary/30 bg-katha-primary/10 text-katha-primary-light',
  completed: 'border-katha-success/30 bg-katha-success/10 text-emerald-200',
  failed: 'border-katha-error/30 bg-katha-error/10 text-red-200',
};

function ImageFallback({ page }: { page: StoryImagePage }) {
  const { copy, language } = useUiCopy();
  const error = page.image_error_code
    ? language === 'vi'
      ? IMAGE_PAGE_ERROR_LABELS[page.image_error_code] || copy.imageDisplayFailed
      : copy.imageDisplayFailed
    : null;

  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-katha-text/[0.06] to-black/25 p-5 text-center text-katha-text/40">
      <div>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="mx-auto h-10 w-10">
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.3" />
          <path d="m5.5 17 4.5-4.5 3 2.8 2.2-2 3.3 3.7" />
        </svg>
        <p className="mt-2 text-xs font-medium text-katha-text/60">
          {page.image_status === 'completed'
            ? copy.illustrationLoadFailed
            : {
                pending: copy.waiting,
                generating: copy.generating,
                completed: copy.completed,
                failed: copy.needsRetry,
              }[page.image_status] || page.image_status}
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
  const { copy } = useUiCopy();
  const statusLabel =
    {
      pending: copy.waiting,
      generating: copy.generating,
      completed: copy.completed,
      failed: copy.needsRetry,
    }[page.image_status] || page.image_status;

  return (
    <section className="katha-card overflow-hidden rounded-xl border border-katha-text/10 bg-katha-field">
      <div className="relative aspect-video overflow-hidden">
        {hasImage ? (
          <Image
            src={imageUrl as string}
            alt={formatCopy(copy.pageIllustration, { page: page.page_no })}
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
      <div className="flex items-center justify-between gap-3 border-t border-katha-text/10 px-3 py-2.5">
        <span className="text-xs font-medium text-katha-text/70">
          {formatCopy(copy.pageIllustration, { page: page.page_no })}
        </span>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${STATUS_STYLES[page.image_status] || STATUS_STYLES.pending}`}>
          {statusLabel}
        </span>
      </div>
    </section>
  );
}
