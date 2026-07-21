'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '@/features/stories/constants';
import { ImageGenerationProgress } from './ImageGenerationProgress';
import { ImagePlanCard } from './ImagePlanCard';
import { StartImageGenerationDialog } from './StartImageGenerationDialog';
import { useStoryImages } from '../useStoryImages';
import type { ImageGenerationDialogMode, StoryImagesState } from '../types';

const STATUS_STYLES: Record<string, string> = {
  text_confirmed: 'border-blue-500/25 bg-blue-500/10 text-blue-200',
  generating_images: 'border-katha-primary/25 bg-katha-primary/10 text-katha-primary-light',
  pending_review: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
  approved: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
  published: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
};

function getGenerationDialogMode(
  state: Pick<StoryImagesState, 'can_resume' | 'can_retry' | 'can_start'>,
): ImageGenerationDialogMode | null {
  if (state.can_resume) return 'resume';
  if (state.can_retry) return 'retry';
  if (state.can_start) return 'start';
  return null;
}

export function StoryImageWorkspace({ storyId }: { storyId: number }) {
  const router = useRouter();
  const images = useStoryImages(storyId);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (images.redirectHref) router.replace(images.redirectHref);
  }, [images.redirectHref, router]);


  if (images.redirectHref) {
    return <WorkspaceMessage title="Đang chuyển đến bước phù hợp…" />;
  }

  if (images.loading) {
    return <WorkspaceSkeleton />;
  }

  if (!images.imageState) {
    return (
      <WorkspaceMessage
        title="Không thể tải không gian minh họa"
        detail={images.error || undefined}
        onRetry={() => void images.refresh()}
      />
    );
  }

  const state = images.imageState;
  const availableGenerationMode = getGenerationDialogMode(state);
  const dialogMode = dialogOpen ? availableGenerationMode : null;
  const generationMode: ImageGenerationDialogMode = availableGenerationMode ?? 'start';
  const unresolvedCount = Math.max(state.progress.total - state.progress.completed, 0);
  const finalizationOnly = state.can_resume && unresolvedCount === 0;
  const dialogPageCount = generationMode === 'start' ? state.progress.total : unresolvedCount;
  const hasGenerationAction = availableGenerationMode !== null;
  const actionsDisabled = Boolean(images.pending || images.blocked);
  const generationDisabled = actionsDisabled || images.mappingDirty;
  const isReadOnly = ['pending_review', 'approved', 'published'].includes(state.status);

  const generationButtonLabel = state.can_resume
    ? finalizationOnly
      ? 'Hoàn tất trạng thái ảnh'
      : 'Tiếp tục sinh ảnh'
    : state.can_retry
      ? `Thử lại ${unresolvedCount} trang lỗi/thiếu`
      : 'Bắt đầu sinh ảnh';

  const openGenerationDialog = () => {
    if (generationDisabled || !hasGenerationAction) return;
    setDialogOpen(true);
  };

  const confirmGeneration = async () => {
    const started = await images.startGeneration();
    if (started) setDialogOpen(false);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/stories" className="text-sm text-white/50 transition hover:text-white">&larr; Quay lại danh sách</Link>
        {state.status === 'text_confirmed' && (
          <Link href={`/admin/stories/${storyId}/edit`} className="text-sm text-white/50 transition hover:text-white">Xem nội dung đã xác nhận</Link>
        )}
      </div>

      <header className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
              <span className={`rounded-full border px-2.5 py-1 ${STATUS_STYLES[state.status] || 'border-white/10 bg-white/[0.04] text-white/60'}`}>
                {STATUS_LABELS[state.status] || state.status}
              </span>
              <span>{state.progress.total} trang nội dung</span>
              <span>·</span>
              <span>image plan revision {state.image_plan_revision}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Minh họa truyện</h1>
            <p className="mt-2 text-sm text-white/55">{state.title_vi || 'Truyện chưa đặt tên'}</p>
          </div>
          {state.mapping_locked && (
            <span className="rounded-xl border border-katha-warning/25 bg-katha-warning/10 px-3 py-2 text-xs font-medium text-amber-100">
              Mapping nhân vật đã khóa
            </span>
          )}
        </div>
      </header>

      {images.notice && (
        <section className="mt-6 rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
          {images.notice}
        </section>
      )}
      {images.error && (
        <section className="mt-6 rounded-xl border border-katha-error/25 bg-katha-error/8 p-4 text-sm text-red-200">
          <p>{images.error}</p>
          {images.blocked && (
            <button
              type="button"
              onClick={() => void images.refresh()}
              className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-katha-surface"
            >
              Kiểm tra lại trạng thái
            </button>
          )}
        </section>
      )}
      {images.pollError && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-katha-warning/25 bg-katha-warning/10 p-4 text-sm text-amber-100">
          <p>{images.pollError} Tiến độ gần nhất vẫn được giữ lại và hệ thống sẽ thử kiểm tra lại.</p>
          <button type="button" onClick={() => void images.refresh()} className="rounded-lg border border-amber-100/25 px-3 py-2 text-xs font-semibold">Kiểm tra ngay</button>
        </section>
      )}

      {state.image_plan_ready && (
        <div className="mt-6">
          <ImageGenerationProgress progress={state.progress} status={state.status} stale={state.job_stale} />
        </div>
      )}

      {!state.image_plan_ready && (
        <section className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-7 text-center sm:p-10">
          <h2 className="text-xl font-semibold">Chưa có kế hoạch minh họa</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/55">
            Kế hoạch sẽ dịch nội dung sang tiếng Anh, mô tả cảnh và đề xuất nhân vật xuất hiện trên từng trang. Bạn vẫn có thể chỉnh mapping trước khi sinh ảnh.
          </p>
          {images.canPreparePlan ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void images.preparePlan()}
              className="mt-6 rounded-lg bg-katha-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {images.pending === 'prepare' ? 'Đang tạo kế hoạch minh họa…' : 'Tạo kế hoạch minh họa'}
            </button>
          ) : (
            <p className="mt-6 text-sm text-white/45">Trạng thái truyện hiện không cho phép tạo hoặc sửa kế hoạch minh họa.</p>
          )}
        </section>
      )}

      {state.image_plan_ready && (
        <>
          {images.canEditMapping && (
            <section className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h2 className="font-semibold">Review mapping nhân vật</h2>
                <p className="mt-1 text-sm text-white/55">
                  {images.mappingDirty
                    ? 'Bạn có thay đổi chưa lưu. Cần lưu mapping cho toàn bộ trang trước khi bắt đầu.'
                    : 'Mapping hiện tại đã được lưu. Bạn có thể chỉnh checkbox trước lần bắt đầu đầu tiên.'}
                </p>
              </div>
              <button
                type="button"
                disabled={!images.mappingDirty || actionsDisabled}
                onClick={() => void images.saveMapping()}
                className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-katha-surface disabled:opacity-40"
              >
                {images.pending === 'save_mapping' ? 'Đang lưu mapping…' : 'Lưu mapping'}
              </button>
            </section>
          )}

          {state.mapping_locked && state.status === 'text_confirmed' && (
            <section className="mt-6 rounded-xl border border-katha-warning/25 bg-katha-warning/10 p-4 text-sm text-amber-100">
              Mapping đã được khóa từ lần bắt đầu đầu tiên. Các ảnh hoàn tất được giữ nguyên; chỉ có thể thử lại những trang thiếu hoặc lỗi.
            </section>
          )}

          {hasGenerationAction && (
            <section className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-katha-primary/25 bg-katha-primary/8 p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h2 className="font-semibold text-katha-primary-light">
                  {state.can_resume
                    ? finalizationOnly
                      ? 'Ảnh đã hoàn tất, cần chốt trạng thái job'
                      : 'Job sinh ảnh đã bị gián đoạn'
                    : state.can_retry
                      ? 'Còn trang minh họa cần xử lý'
                      : 'Sẵn sàng sinh minh họa'}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  {images.mappingDirty
                    ? 'Hãy lưu mapping nhân vật trước khi tiếp tục.'
                    : state.can_resume
                      ? finalizationOnly
                        ? 'Tất cả ảnh nội dung đã lưu. Xác nhận để hoàn tất trạng thái job, không tạo ảnh mới.'
                        : 'Tiếp tục sẽ reclaim job và chỉ xử lý các trang chưa hoàn tất.'
                      : state.can_retry
                        ? 'Ảnh đã hoàn tất sẽ không bị sinh lại.'
                        : 'Bước này chỉ tạo ảnh nội dung, không tạo ảnh bìa.'}
                </p>
              </div>
              <button
                type="button"
                disabled={generationDisabled}
                onClick={openGenerationDialog}
                className="shrink-0 rounded-lg bg-katha-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {images.pending === 'start' ? 'Đang gửi yêu cầu…' : generationButtonLabel}
              </button>
            </section>
          )}

          {isReadOnly && (
            <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
              <p>Toàn bộ ảnh nội dung đã hoàn tất. Phase 4 chỉ hiển thị kết quả; bước review/approve sẽ được nối ở Phase 5.</p>
              <Link href="/admin/stories" className="rounded-lg border border-emerald-200/25 px-3 py-2 text-xs font-semibold">Về danh sách truyện</Link>
            </section>
          )}

          <section className="mt-8 space-y-6" aria-label="Kế hoạch và minh họa theo trang">
            {state.pages.map((page) => (
              <ImagePlanCard
                key={page.id}
                page={page}
                characters={state.available_characters}
                selectedCharacterIds={images.draftMappings[page.id] || page.character_ids}
                mappingEditable={images.canEditMapping}
                disabled={actionsDisabled}
                onMappingChange={(characterIds) => images.updatePageCharacters(page.id, characterIds)}
              />
            ))}
          </section>
        </>
      )}

      {dialogMode && (
        <StartImageGenerationDialog
          mode={dialogMode}
          pageCount={dialogPageCount}
          finalizationOnly={finalizationOnly}
          pending={images.pending === 'start'}
          error={images.error}
          blocked={images.blocked}
          onClose={() => setDialogOpen(false)}
          onConfirm={() => void confirmGeneration()}
          onReconcile={() => void images.refresh()}
        />
      )}
    </main>
  );
}

function WorkspaceSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14" aria-label="Đang tải không gian minh họa">
      <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />
      <div className="mt-6 h-36 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="mt-6 h-80 animate-pulse rounded-2xl bg-white/[0.035]" />
    </main>
  );
}

function WorkspaceMessage({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {detail && <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/55">{detail}</p>}
        {onRetry && <button type="button" onClick={onRetry} className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-katha-surface">Thử lại</button>}
        <div><Link href="/admin/stories" className="mt-5 inline-block text-sm text-white/50">Quay lại danh sách</Link></div>
      </section>
    </main>
  );
}
