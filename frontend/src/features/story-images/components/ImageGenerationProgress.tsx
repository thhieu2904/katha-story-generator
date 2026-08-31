import type { StoryImageProgress } from '../types';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

interface ImageGenerationProgressProps {
  progress: StoryImageProgress;
  status: string;
  stale: boolean;
  activePageNo?: number;
}

export function ImageGenerationProgress({
  progress,
  status,
  stale,
  activePageNo,
}: ImageGenerationProgressProps) {
  const { copy } = useUiCopy();
  const completed = Math.min(progress.completed, progress.total);
  const statusText = stale
    ? copy.interruptedContinueHelp
    : activePageNo
      ? formatCopy(copy.generatingImagePage, {
          page: activePageNo,
          completed,
          total: progress.total,
        })
      : status === 'generating_images'
        ? formatCopy(copy.preparingNextPage, { completed, total: progress.total })
        : status === 'pending_review'
          ? formatCopy(copy.imagesCompletedReady, { completed, total: progress.total })
          : formatCopy(copy.imagesCompletedCount, { completed, total: progress.total });

  return (
    <section
      className="rounded-2xl border border-katha-text/10 bg-katha-text/[0.025] p-5 sm:p-6 space-y-4"
      aria-labelledby="image-progress-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="image-progress-heading" className="text-base font-semibold text-katha-text">
            {copy.imageGenerationProgress}
          </h2>
          <p role="status" aria-live="polite" className="mt-1 text-sm text-katha-text/60">
            {statusText}
          </p>
        </div>
        <span className="text-lg font-bold text-katha-text">
          {completed}/{progress.total}
        </span>
      </div>

      <progress
        className="h-2 w-full overflow-hidden rounded-full accent-katha-primary"
        value={completed}
        max={Math.max(progress.total, 1)}
        aria-label={copy.imageProgressAria}
        aria-valuetext={formatCopy(copy.imagesCompletedAria, {
          completed,
          total: progress.total,
        })}
      />

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-katha-text/[0.035] px-3 py-2">
          <dt className="text-katha-text/40">{copy.waiting}</dt>
          <dd className="mt-1 font-semibold text-katha-text/80">{progress.pending}</dd>
        </div>
        <div className="rounded-lg bg-katha-primary/10 px-3 py-2">
          <dt className="text-katha-text/40">{copy.generating}</dt>
          <dd className="mt-1 font-semibold text-katha-primary-light">
            {progress.generating}
          </dd>
        </div>
        <div className="rounded-lg bg-katha-success/10 px-3 py-2">
          <dt className="text-katha-text/40">{copy.completed}</dt>
          <dd className="mt-1 font-semibold text-emerald-200">{progress.completed}</dd>
        </div>
        <div className="rounded-lg bg-katha-error/10 px-3 py-2">
          <dt className="text-katha-text/40">{copy.needsRetry}</dt>
          <dd className="mt-1 font-semibold text-red-200">{progress.failed}</dd>
        </div>
      </dl>

      <p className="text-xs text-katha-text/45 pt-1">
        {copy.imageGenerationTimeHelp}
      </p>
    </section>
  );
}
