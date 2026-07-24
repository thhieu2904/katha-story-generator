import type { StoryImageProgress } from '../types';

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
  const completed = Math.min(progress.completed, progress.total);
  const statusText = stale
    ? 'Quá trình tạo ảnh bị gián đoạn; hãy tiếp tục thủ công để sinh các trang còn thiếu.'
    : activePageNo
      ? `Đang tạo trang ${activePageNo} · ${completed}/${progress.total} ảnh hoàn tất`
      : status === 'generating_images'
        ? `Chuẩn bị trang tiếp theo · ${completed}/${progress.total} ảnh hoàn tất`
        : status === 'pending_review'
          ? `Đã hoàn tất ${completed}/${progress.total} ảnh và sẵn sàng duyệt.`
          : `Đã hoàn tất ${completed}/${progress.total} ảnh.`;

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6 space-y-4"
      aria-labelledby="image-progress-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="image-progress-heading" className="text-base font-semibold text-white">
            Tiến độ tạo ảnh
          </h2>
          <p role="status" aria-live="polite" className="mt-1 text-sm text-white/60">
            {statusText}
          </p>
        </div>
        <span className="text-lg font-bold text-white">
          {completed}/{progress.total}
        </span>
      </div>

      <progress
        className="h-2 w-full overflow-hidden rounded-full accent-katha-primary"
        value={completed}
        max={Math.max(progress.total, 1)}
        aria-label="Tiến độ sinh ảnh"
        aria-valuetext={`${completed} trên ${progress.total} ảnh đã hoàn tất`}
      />

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-white/[0.035] px-3 py-2">
          <dt className="text-white/40">Đang chờ</dt>
          <dd className="mt-1 font-semibold text-white/80">{progress.pending}</dd>
        </div>
        <div className="rounded-lg bg-katha-primary/10 px-3 py-2">
          <dt className="text-white/40">Đang tạo</dt>
          <dd className="mt-1 font-semibold text-katha-primary-light">
            {progress.generating}
          </dd>
        </div>
        <div className="rounded-lg bg-katha-success/10 px-3 py-2">
          <dt className="text-white/40">Hoàn tất</dt>
          <dd className="mt-1 font-semibold text-emerald-200">{progress.completed}</dd>
        </div>
        <div className="rounded-lg bg-katha-error/10 px-3 py-2">
          <dt className="text-white/40">Cần thử lại</dt>
          <dd className="mt-1 font-semibold text-red-200">{progress.failed}</dd>
        </div>
      </dl>

      <p className="text-xs text-white/45 pt-1">
        Mỗi ảnh có thể mất vài phút. Bạn có thể quay lại xem sau; các ảnh đã hoàn tất sẽ được giữ lại.
      </p>
    </section>
  );
}
