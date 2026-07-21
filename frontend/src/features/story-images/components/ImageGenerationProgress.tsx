import type { StoryImageProgress } from '../types';

interface ImageGenerationProgressProps {
  progress: StoryImageProgress;
  status: string;
  stale: boolean;
}

export function ImageGenerationProgress({
  progress,
  status,
  stale,
}: ImageGenerationProgressProps) {
  const completed = Math.min(progress.completed, progress.total);
  const statusText = stale
    ? 'Job sinh ảnh bị gián đoạn; hãy tiếp tục thủ công để sinh các trang còn thiếu.'
    : status === 'generating_images'
      ? `Đã hoàn tất ${completed}/${progress.total} ảnh nội dung.`
      : status === 'pending_review'
        ? `Đã hoàn tất ${completed}/${progress.total} ảnh nội dung và đang chờ duyệt.`
        : `Đã hoàn tất ${completed}/${progress.total} ảnh nội dung.`;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6" aria-labelledby="image-progress-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="image-progress-heading" className="text-base font-semibold">Tiến độ minh họa</h2>
          <p role="status" aria-live="polite" className="mt-1 text-sm text-white/55">{statusText}</p>
        </div>
        <span className="text-lg font-semibold text-white">{completed}/{progress.total}</span>
      </div>
      <progress
        className="mt-4 h-2 w-full overflow-hidden rounded-full accent-katha-primary"
        value={completed}
        max={Math.max(progress.total, 1)}
        aria-label="Tiến độ sinh ảnh nội dung"
        aria-valuetext={`${completed} trên ${progress.total} ảnh nội dung đã hoàn tất`}
      />
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-white/[0.035] px-3 py-2"><dt className="text-white/40">Đang chờ</dt><dd className="mt-1 font-semibold text-white/80">{progress.pending}</dd></div>
        <div className="rounded-lg bg-katha-primary/8 px-3 py-2"><dt className="text-white/40">Đang sinh</dt><dd className="mt-1 font-semibold text-katha-primary-light">{progress.generating}</dd></div>
        <div className="rounded-lg bg-katha-success/8 px-3 py-2"><dt className="text-white/40">Hoàn tất</dt><dd className="mt-1 font-semibold text-emerald-200">{progress.completed}</dd></div>
        <div className="rounded-lg bg-katha-error/8 px-3 py-2"><dt className="text-white/40">Cần thử lại</dt><dd className="mt-1 font-semibold text-red-200">{progress.failed}</dd></div>
      </dl>
    </section>
  );
}
