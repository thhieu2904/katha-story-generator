'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StoryRouteKey } from '@/features/stories/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { useIsMobileCompact } from '@/features/story-workflow/useIsMobileCompact';
import { STORY_STATUS_LABELS } from '../constants';
import { useStoryReview } from '../useStoryReview';
import type { ReviewPageData, ReviewState } from '../types';
import { ReviewProgress as ReviewProgressBar } from './ReviewProgress';
import { ReviewPageCard } from './ReviewPageCard';
import { CompleteReviewDialog } from './CompleteReviewDialog';

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-16 bg-white/5 rounded-2xl w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-96 bg-white/5 rounded-2xl" />
        ))}
      </div>
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
    <div className="flex flex-col items-center justify-center p-12 text-center bg-katha-surface-light rounded-2xl border border-white/5">
      <h3 className="text-xl font-medium text-white mb-2">{title}</h3>
      {detail && <p className="text-gray-400 mb-6">{detail}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-colors"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending_review:
    'bg-katha-warning/10 text-amber-300 border-katha-warning/20',
  generating_images:
    'bg-katha-primary/10 text-katha-primary-light border-katha-primary/20',
  approved: 'bg-katha-success/10 text-emerald-300 border-katha-success/20',
  published: 'bg-katha-success/10 text-emerald-300 border-katha-success/20',
};

export function StoryReviewWorkspace({
  storyKey,
}: {
  storyKey: StoryRouteKey;
}) {
  const { story, loading, error, retry } = useStoryByRouteKey(storyKey);

  if (loading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (error || !story || !story.id) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage
          title="Không thể tải không gian duyệt truyện"
          detail={error || undefined}
          onRetry={retry}
        />
      </StoryWorkflowShell>
    );
  }

  return (
    <StoryReviewWorkspaceInner storyId={story.id} storyKey={storyKey} />
  );
}

function StoryReviewWorkspaceInner({
  storyId,
  storyKey,
}: {
  storyId: number;
  storyKey: StoryRouteKey;
}) {
  const isMobileCompact = useIsMobileCompact();
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const {
    reviewState,
    loading,
    error,
    pollError,
    refresh,
    editingPageId,
    setEditingPageId,
    mutating,
    handleEditKhmerTitle,
    handleEditKhmerPage,
    handleApprovePage,
    handleRejectPage,
    handleCompleteReview,
    handleRegenerateImage,
  } = useStoryReview(storyId);

  if (loading && !reviewState) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (error && !reviewState) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage
          title="Lỗi tải dữ liệu duyệt truyện"
          detail={error}
          onRetry={refresh}
        />
      </StoryWorkflowShell>
    );
  }

  if (!reviewState) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage title="Không có dữ liệu" onRetry={refresh} />
      </StoryWorkflowShell>
    );
  }

  const { story, pages, progress, capabilities, job } = reviewState;

  const handleCompleteConfirm = async () => {
    try {
      setIsCompleting(true);
      await handleCompleteReview(story.text_revision);
      setCompleteDialogOpen(false);
    } finally {
      setIsCompleting(false);
    }
  };

  const handlePageEditSave = async (pageId: number, text: string) => {
    const success = await handleEditKhmerPage(
      pageId,
      text,
      story.text_revision,
    );
    if (success) {
      setEditingPageId(null);
    }
  };

  const handlePageApprove = async (page: ReviewPageData) => {
    const hasWarnings =
      (page.spellcheck_flags && page.spellcheck_flags.length > 0) ||
      !page.khmer_validated_at;
    await handleApprovePage(page.id, {
      acknowledgeKhmerWarnings: hasWarnings,
      expectedTextRevision: story.text_revision,
      expectedReviewStatus: page.review_status,
      expectedImageAttemptCount: page.image_attempt_count,
      expectedImageUrl: page.image_url || '',
    });
  };

  const handlePageReject = async (
    page: ReviewPageData,
    reason: string,
  ) => {
    await handleRejectPage(page.id, {
      reason,
      expectedTextRevision: story.text_revision,
      expectedReviewStatus: page.review_status,
      expectedImageAttemptCount: page.image_attempt_count,
      expectedImageUrl: page.image_url || '',
    });
  };

  const handlePageRegenerate = async (page: ReviewPageData) => {
    await handleRegenerateImage(page.id, {
      expectedTextRevision: story.text_revision,
      expectedReviewStatus: page.review_status,
      expectedImageAttemptCount: page.image_attempt_count,
      expectedImageUrl: page.image_url || '',
    });
  };

  const isJobRunning = job.is_running;
  const statusLabel =
    STORY_STATUS_LABELS[story.status] || story.status;
  const statusStyle =
    STATUS_BADGE_STYLES[story.status] || STATUS_BADGE_STYLES.pending_review;

  const actionBar = capabilities.can_complete_review ? (
    <div className="flex justify-end w-full">
      <button
        onClick={() => setCompleteDialogOpen(true)}
        disabled={mutating || isCompleting}
        className="px-6 py-3 rounded-xl font-medium bg-katha-primary hover:bg-katha-primary-light text-white transition-colors disabled:opacity-50"
      >
        Hoàn tất duyệt truyện
      </button>
    </div>
  ) : null;

  return (
    <StoryWorkflowShell storyKey={storyKey} actionBar={actionBar}>
      {/* Poll error banner */}
      {pollError && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm flex items-center justify-between">
          <span>
            Không thể cập nhật trạng thái mới nhất. Dữ liệu có thể cũ.
          </span>
          <button
            onClick={refresh}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs font-medium"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && reviewState && (
        <div className="mb-6 p-4 rounded-xl bg-katha-error/10 border border-katha-error/20 text-red-200 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={refresh}
            className="px-3 py-1.5 bg-katha-error/20 hover:bg-katha-error/30 rounded-lg text-xs font-medium"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Job running overlay banner */}
      {isJobRunning && (
        <div className="mb-6 p-4 rounded-xl bg-katha-primary/10 border border-katha-primary/20 text-blue-200 text-sm flex items-center gap-3">
          <svg
            className="w-5 h-5 animate-spin text-katha-primary-light"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>
            Đang tạo bản thay thế ảnh. Các thao tác duyệt tạm bị tắt.
          </span>
        </div>
      )}

      {/* Header section */}
      <div className="mb-8 space-y-6">
        <div className="bg-katha-surface-light rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusStyle}`}
            >
              {statusLabel}
            </span>
            {capabilities.read_only && (
              <span className="text-xs text-gray-400">Chỉ đọc</span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-khmer text-white mb-1">
                {story.title_km || 'Chưa có tiêu đề Khmer'}
              </h2>
              <p className="text-sm text-gray-400">
                {story.title_vi || 'Chưa có tiêu đề'}
              </p>
            </div>

            <ReviewProgressBar progress={progress} />
          </div>
        </div>
      </div>

      {/* Mobile compact guard */}
      {isMobileCompact && (
        <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm text-center">
          Mở trên tablet hoặc máy tính để chỉnh sửa chi tiết
        </div>
      )}

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pages.map((page) => (
          <ReviewPageCard
            key={page.id}
            page={page}
            reviewState={reviewState}
            isMobileCompact={isMobileCompact}
            disabled={mutating || isCompleting || isJobRunning}
            isEditing={editingPageId === page.id}
            onEditStart={() => setEditingPageId(page.id)}
            onEditCancel={() => setEditingPageId(null)}
            onEditSave={(text) => handlePageEditSave(page.id, text)}
            onApprove={() => handlePageApprove(page)}
            onReject={(reason) => handlePageReject(page, reason)}
            onRegenerate={() => handlePageRegenerate(page)}
            isMutating={mutating}
          />
        ))}
      </div>

      <CompleteReviewDialog
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        onConfirm={handleCompleteConfirm}
        isSubmitting={isCompleting}
        progress={progress}
      />
    </StoryWorkflowShell>
  );
}
