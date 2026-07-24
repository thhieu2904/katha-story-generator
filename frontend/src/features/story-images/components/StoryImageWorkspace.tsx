'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '@/features/stories/constants';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { orchestrateSaveAndStart } from '@/features/story-workflow/orchestration';
import type { SaveAndStartResult } from '@/features/story-workflow/orchestration';
import { useIsMobileCompact } from '@/features/story-workflow/useIsMobileCompact';
import { ImageGenerationProgress } from './ImageGenerationProgress';
import { ImagePageProgressGrid } from './ImagePageProgressGrid';
import { ImagePlanCard } from './ImagePlanCard';
import { ImagePlanCompactRow } from './ImagePlanCompactRow';
import { StartImageGenerationDialog } from './StartImageGenerationDialog';
import { useStoryImages } from '../useStoryImages';
import type { ImageGenerationDialogMode, StoryImagesState } from '../types';

import type { StoryRouteKey } from '@/features/stories/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';

const STATUS_STYLES: Record<string, string> = {
  text_confirmed: 'border-blue-500/25 bg-blue-500/10 text-blue-200',
  generating_images: 'border-katha-primary/25 bg-katha-primary/10 text-katha-primary-light',
  pending_review: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
  approved: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
  published: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
};

function getGenerationDialogMode(
  state: Pick<StoryImagesState, 'can_resume' | 'can_retry' | 'can_start'>
): ImageGenerationDialogMode | null {
  if (state.can_resume) return 'resume';
  if (state.can_retry) return 'retry';
  if (state.can_start) return 'start';
  return null;
}

export function StoryImageWorkspace({ storyKey }: { storyKey: StoryRouteKey }) {
  const { story, loading: storyLoading, error: fetchError, retry } = useStoryByRouteKey(storyKey);

  if (storyLoading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (fetchError || !story || !story.id) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage
          title="Không thể tải không gian minh họa"
          detail={fetchError || undefined}
          onRetry={retry}
        />
      </StoryWorkflowShell>
    );
  }

  return <StoryImageWorkspaceInner storyId={story.id} storyKey={storyKey} />;
}

function StoryImageWorkspaceInner({
  storyId,
  storyKey,
}: {
  storyId: number;
  storyKey: StoryRouteKey;
}) {
  const router = useRouter();
  const images = useStoryImages(storyId);
  const isMobileCompact = useIsMobileCompact();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isStartingOrSaving, setIsStartingOrSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [useCompactView, setUseCompactView] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (images.redirectHref) router.replace(images.redirectHref);
  }, [images.redirectHref, router]);

  if (images.redirectHref) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage title="Đang chuyển đến bước phù hợp…" />
      </StoryWorkflowShell>
    );
  }

  if (images.loading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (!images.imageState) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage
          title="Không thể tải không gian minh họa"
          detail={images.error || undefined}
          onRetry={() => void images.refresh()}
        />
      </StoryWorkflowShell>
    );
  }

  const state = images.imageState;
  const availableGenerationMode = getGenerationDialogMode(state);
  const dialogMode = dialogOpen ? availableGenerationMode : null;
  const generationMode: ImageGenerationDialogMode =
    availableGenerationMode ?? 'start';
  const unresolvedCount = Math.max(
    state.progress.total - state.progress.completed,
    0
  );
  const finalizationOnly = state.can_resume && unresolvedCount === 0;
  const dialogPageCount =
    generationMode === 'start' ? state.progress.total : unresolvedCount;
  const hasGenerationAction = availableGenerationMode !== null;
  const actionsDisabled = Boolean(
    images.pending || images.blocked || isStartingOrSaving || isBlocked || images.mappingConflict
  );
  // B6: Mobile with dirty mapping cannot start (needs desktop to save)
  const generationDisabled = actionsDisabled || (isMobileCompact && images.mappingDirty);
  const isReadOnly = ['pending_review', 'approved', 'published'].includes(
    state.status
  );

  const hasRecoveryAction = Boolean(
    state.job_stale || state.can_resume || state.can_retry
  );
  const isGeneratingMode =
    state.status === 'generating_images' && !hasRecoveryAction;

  const confirmGeneration = async () => {
    setIsStartingOrSaving(true);
    setActionError(null);

    const mappingPayload = state.pages.map((p) => ({
      page_id: p.id,
      character_ids: images.draftMappings[p.id] || p.character_ids,
    }));

    const result: SaveAndStartResult = await orchestrateSaveAndStart(
      storyId,
      images.mappingDirty,
      mappingPayload,
      state.image_plan_revision,
      state,
      // B1: Install save response inline between save → start.
      (saved) => images.installSaveResponse(saved),
      storyKey
    );

    if (result.kind === 'success') {
      setDialogOpen(false);
      setIsStartingOrSaving(false);
      const res = await images.refresh();
      if (res?.ok) {
        setIsBlocked(false);
      } else {
        // Refresh failed after success — block to prevent stale CTA
        setIsBlocked(true);
      }
    } else if (result.kind === 'partial') {
      setDialogOpen(false);
      setActionError(result.message);
      setIsStartingOrSaving(false);
      const res = await images.refresh();
      if (res?.ok) {
        setIsBlocked(false);
      } else {
        // Refresh failed after partial — block to prevent stale CTA
        setIsBlocked(true);
      }
    } else if (result.kind === 'blocked') {
      setDialogOpen(false);
      setActionError(result.message);
      setIsStartingOrSaving(false);
      // B1: Install savedState for blocked results too (save committed but start couldn't proceed)
      if ('savedState' in result && result.savedState) {
        images.installSaveResponse(result.savedState);
      }
      setIsBlocked(true);
    } else {
      setActionError(result.message);
      setIsStartingOrSaving(false);
    }
  };

  const handleSaveMappingOnly = async () => {
    if (actionsDisabled || !images.mappingDirty) return;
    await images.saveMapping();
  };

  let actionBar: React.ReactNode = null;

  if (isBlocked || images.blocked) {
    // B4: Only clear blocked AFTER successful refresh
    const handleCheckStatus = async () => {
      const result = await images.refresh();
      if (result.ok) {
        setIsBlocked(false);
      }
    };
    actionBar = (
      <>
        <div className="text-xs text-rose-300">
          Chưa thể xác nhận trạng thái mới nhất. Hãy kiểm tra lại.
        </div>
        <button
          type="button"
          onClick={() => void handleCheckStatus()}
          className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-katha-surface shadow transition hover:bg-white/90"
        >
          Kiểm tra lại trạng thái
        </button>
      </>
    );
  } else if (images.mappingConflict) {
    // B5: Mapping conflict — server data changed
    actionBar = (
      <>
        <div className="text-xs text-amber-200">
          Dữ liệu trên máy chủ đã thay đổi. Vui lòng tải lại trước khi tiếp tục.
        </div>
        <button
          type="button"
          onClick={() => void images.discardAndReload()}
          className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-katha-surface shadow transition hover:bg-white/90"
        >
          Tải trạng thái mới nhất
        </button>
      </>
    );
  } else if (!state.image_plan_ready && images.canPreparePlan) {
    actionBar = (
      <>
        <div className="text-xs text-white/50">Nội dung đã xác nhận.</div>
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={() => void images.preparePlan()}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {images.pending === 'prepare'
            ? 'Đang chuẩn bị minh họa…'
            : 'Chuẩn bị minh họa'}
        </button>
      </>
    );
  } else if (isGeneratingMode) {
    actionBar = (
      <>
        <div className="text-xs text-white/60 font-medium">
          {images.activePage
            ? `Đang tạo trang ${images.activePage.page_no} · ${state.progress.completed}/${state.progress.total} ảnh hoàn tất`
            : `Đang xử lý · ${state.progress.completed}/${state.progress.total} ảnh hoàn tất`}
        </div>
        <span className="text-xs text-katha-primary-light font-medium flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-katha-primary animate-ping" />
          Tự động cập nhật 3s
        </span>
      </>
    );
  } else if (hasGenerationAction) {
    const primaryLabel = state.can_resume
      ? finalizationOnly
        ? 'Đồng bộ kết quả'
        : `Tiếp tục ${unresolvedCount} ảnh còn lại`
      : state.can_retry
        ? `Thử lại ${unresolvedCount} ảnh`
        : `Bắt đầu sinh ${state.progress.total} ảnh`;

    actionBar = (
      <>
        <div className="text-xs text-white/50 hidden sm:block">
          {images.mappingDirty
            ? 'Lựa chọn nhân vật sẽ được lưu trước khi bắt đầu.'
            : state.can_resume
              ? 'Quá trình tạo ảnh bị gián đoạn.'
              : state.can_retry
                ? `Có ${unresolvedCount} ảnh cần thử lại.`
                : 'Đã sẵn sàng tạo ảnh.'}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {images.canEditMapping && images.mappingDirty && !isMobileCompact && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void handleSaveMappingOnly()}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              {images.pending === 'save_mapping' ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          )}
          <button
            type="button"
            disabled={generationDisabled}
            onClick={() => setDialogOpen(true)}
            className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
          >
            {isStartingOrSaving ? 'Đang khởi chạy…' : primaryLabel}
          </button>
        </div>
      </>
    );
  } else if (isReadOnly) {
    actionBar = (
      <>
        <div className="text-xs text-white/50">
          Tất cả ảnh đã hoàn tất.
        </div>
        <button
          type="button"
          disabled
          className="rounded-xl bg-katha-success/20 border border-katha-success/30 px-5 py-2.5 text-xs font-semibold text-emerald-200"
        >
          Sẵn sàng duyệt
        </button>
      </>
    );
  }

  const mappingEditable = images.canEditMapping && !isMobileCompact;

  return (
    <StoryWorkflowShell
      storyKey={storyKey}
      storyTitle={state.title_vi || 'Truyện chưa đặt tên'}
      status={state.status}
      actionBar={actionBar}
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
              Minh họa truyện
            </h1>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLES[state.status] ||
                'border-white/10 bg-white/[0.04] text-white/60'
              }`}
            >
              {STATUS_LABELS[state.status] || state.status}
            </span>
          </div>
          <p className="text-sm text-white/60">
            {state.title_vi || 'Truyện chưa đặt tên'}
          </p>
        </div>

        {isMobileCompact && images.canEditMapping && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
            💡 Mở trên tablet hoặc máy tính (tối thiểu 768×600) để tùy chỉnh phân bổ nhân vật theo từng trang.
          </div>
        )}

        {/* B6: Mobile dirty mapping warning */}
        {isMobileCompact && images.mappingDirty && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-200">
            ⚠️ Bạn có thay đổi nhân vật chưa lưu. Hãy mở trên máy tính để lưu và bắt đầu sinh ảnh.
          </div>
        )}

        {/* B5: Mapping conflict banner */}
        {images.mappingConflict && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-3">
            <p>Dữ liệu trên máy chủ đã thay đổi. Bản nháp cục bộ của bạn có thể không còn phù hợp.</p>
            <button
              type="button"
              onClick={() => void images.discardAndReload()}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-katha-surface"
            >
              Tải trạng thái mới nhất
            </button>
          </div>
        )}

        {images.notice && (
          <div className="rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
            {images.notice}
          </div>
        )}

        {(images.error || actionError) && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200 flex flex-wrap items-center justify-between gap-3">
            <p>{images.error || actionError}</p>
            {(images.blocked || isBlocked) && (
              <button
                type="button"
                onClick={() => {
                  void images.refresh().then((result) => {
                    if (result.ok) setIsBlocked(false);
                  });
                }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-katha-surface"
              >
                Kiểm tra lại trạng thái
              </button>
            )}
          </div>
        )}

        {images.pollError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-katha-warning/25 bg-katha-warning/10 p-4 text-sm text-amber-100">
            <p>
              {images.pollError} Tiến độ gần nhất vẫn được giữ lại và hệ thống sẽ tự thử lại.
            </p>
            <button
              type="button"
              onClick={() => void images.refresh()}
              className="rounded-lg border border-amber-100/25 px-3 py-1.5 text-xs font-semibold"
            >
              Kiểm tra ngay
            </button>
          </div>
        )}

        {/* Missing plan view */}
        {!state.image_plan_ready && (
          <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center sm:p-12 space-y-4">
            <h2 className="text-xl font-semibold text-white">
              Chưa chuẩn bị kế hoạch minh họa
            </h2>
            <p className="mx-auto max-w-xl text-sm text-white/60 leading-relaxed">
              Kế hoạch minh họa sẽ tự động phân tích từng trang, đề xuất các cảnh quay và gán nhân vật xuất hiện.
            </p>
          </section>
        )}

        {/* Image Plan Ready */}
        {state.image_plan_ready && (
          <>
            {/* Generation Progress Bar */}
            <ImageGenerationProgress
              progress={state.progress}
              status={state.status}
              stale={state.job_stale}
              activePageNo={images.activePage?.page_no}
            />

            {/* Generating Mode: Show ImagePageProgressGrid as primary */}
            {isGeneratingMode && (
              <div className="pt-2">
                <ImagePageProgressGrid pages={state.pages} />
              </div>
            )}

            {/* Non-generating or Recovery modes: Mapping review / plan display */}
            {!isGeneratingMode && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="text-lg font-semibold text-white">
                    Kiểm tra nhân vật từng trang
                  </h2>
                  <button
                    type="button"
                    onClick={() => setUseCompactView(!useCompactView)}
                    className="text-xs text-katha-primary-light hover:underline"
                  >
                    {useCompactView ? 'Xem dạng đầy đủ' : 'Xem dạng thu gọn'}
                  </button>
                </div>

                <div className="space-y-6">
                  {state.pages.map((page) =>
                    useCompactView ? (
                      <ImagePlanCompactRow
                        key={page.id}
                        page={page}
                        characters={state.available_characters}
                        selectedCharacterIds={
                          images.draftMappings[page.id] || page.character_ids
                        }
                        mappingEditable={mappingEditable}
                        disabled={actionsDisabled}
                        onMappingChange={(characterIds) =>
                          images.updatePageCharacters(page.id, characterIds)
                        }
                      />
                    ) : (
                      <ImagePlanCard
                        key={page.id}
                        page={page}
                        characters={state.available_characters}
                        selectedCharacterIds={
                          images.draftMappings[page.id] || page.character_ids
                        }
                        mappingEditable={mappingEditable}
                        disabled={actionsDisabled}
                        onMappingChange={(characterIds) =>
                          images.updatePageCharacters(page.id, characterIds)
                        }
                      />
                    )
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {dialogMode && (
        <StartImageGenerationDialog
          mode={dialogMode}
          pageCount={dialogPageCount}
          finalizationOnly={finalizationOnly}
          pending={isStartingOrSaving || images.pending === 'start'}
          error={images.error || actionError}
          blocked={images.blocked || isBlocked}
          onClose={() => setDialogOpen(false)}
          onConfirm={() => void confirmGeneration()}
          onReconcile={async () => {
            const res = await images.refresh();
            if (res?.ok) {
              setIsBlocked(false);
            }
          }}
        />
      )}
    </StoryWorkflowShell>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Đang tải không gian minh họa">
      <div className="h-28 rounded-2xl bg-white/[0.05]" />
      <div className="h-36 rounded-2xl bg-white/[0.04]" />
      <div className="h-80 rounded-2xl bg-white/[0.035]" />
    </div>
  );
}

function WorkspaceMessage({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {detail && (
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/55">
          {detail}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-katha-surface"
        >
          Thử lại
        </button>
      )}
    </section>
  );
}
