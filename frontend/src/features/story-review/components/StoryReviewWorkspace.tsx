'use client';

import { useState } from 'react';
import type { StoryRouteKey } from '@/features/stories/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { useIsMobileCompact } from '@/features/story-workflow/useIsMobileCompact';
import { STORY_STATUS_LABELS } from '../constants';
import { useStoryReview } from '../useStoryReview';
import type { ReviewPageData } from '../types';
import { ReviewProgress as ReviewProgressBar } from './ReviewProgress';
import { ReviewPageCard } from './ReviewPageCard';
import { CompleteReviewDialog } from './CompleteReviewDialog';
import { PublishStoryDialog } from './PublishStoryDialog';
import { ShareLinkPanel } from './ShareLinkPanel';
import { StopSharingDialog } from './StopSharingDialog';
import { ArchiveReviewDialog } from './ArchiveReviewDialog';
import { EditKhmerTitleDialog } from './EditKhmerTitleDialog';

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
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [editTitleDialogOpen, setEditTitleDialogOpen] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

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
    handlePublish,
    handleRevokeShare,
    handleCreateShareLink,
    handleArchive,
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

  const handlePublishConfirm = async () => {
    try {
      setIsPublishing(true);
      await handlePublish(story.text_revision, reviewState.share.revision);
      setPublishDialogOpen(false);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRevokeConfirm = async () => {
    try {
      setIsRevoking(true);
      await handleRevokeShare(reviewState.share.revision);
      setRevokeDialogOpen(false);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleArchiveConfirm = async () => {
    try {
      setIsArchiving(true);
      await handleArchive(story.status, reviewState.share.revision);
      setArchiveDialogOpen(false);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCreateShareLinkAction = async () => {
    await handleCreateShareLink(reviewState.share.revision);
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

  const handleSaveTitleKm = async (newTitleKm: string) => {
    try {
      setIsSavingTitle(true);
      const success = await handleEditKhmerTitle(newTitleKm, story.text_revision);
      if (success) setEditTitleDialogOpen(false);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handlePageApprove = async (
    page: ReviewPageData,
    acknowledgeKhmerWarnings: boolean,
  ) => {
    await handleApprovePage(page.id, {
      acknowledgeKhmerWarnings,
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

  let actionBar = null;
  if (story.status === 'pending_review' || story.status === 'generating_images') {
    if (capabilities.can_complete_review) {
      actionBar = (
        <div className="flex justify-end w-full">
          <button
            onClick={() => setCompleteDialogOpen(true)}
            disabled={mutating || isCompleting}
            className="px-6 py-3 rounded-xl font-medium bg-katha-primary hover:bg-katha-primary-light text-white transition-colors disabled:opacity-50"
          >
            Hoàn tất duyệt truyện
          </button>
        </div>
      );
    }
  } else if (story.status === 'approved') {
    if (capabilities.can_publish) {
      actionBar = (
        <div className="flex justify-end w-full">
          <button
            onClick={() => setPublishDialogOpen(true)}
            disabled={mutating || isPublishing}
            className="px-6 py-3 rounded-xl font-medium bg-katha-primary hover:bg-katha-primary-light text-white transition-colors disabled:opacity-50"
          >
            Xuất bản và tạo liên kết
          </button>
        </div>
      );
    }
  }

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
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-khmer text-white">
                  {story.title_km || 'Chưa có tiêu đề Khmer'}
                </h2>
                {capabilities.can_edit_khmer && !isMobileCompact && (
                  <button
                    onClick={() => setEditTitleDialogOpen(true)}
                    disabled={mutating}
                    className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Sửa tiêu đề Khmer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
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

      {/* Share Link Panel (for published stories) */}
      {story.status === 'published' && (
        <div className="mb-8">
          <ShareLinkPanel
            share={reviewState.share}
            capabilities={capabilities}
            storyTitle={story.title_vi}
            onRevokeShare={() => setRevokeDialogOpen(true)}
            onCreateShareLink={handleCreateShareLinkAction}
            onArchive={() => setArchiveDialogOpen(true)}
            disabled={mutating || isPublishing || isRevoking || isArchiving}
          />
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
            onApprove={(ack) => handlePageApprove(page, ack)}
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

      <PublishStoryDialog
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        onConfirm={handlePublishConfirm}
        isSubmitting={isPublishing}
      />

      <StopSharingDialog
        open={revokeDialogOpen}
        onClose={() => setRevokeDialogOpen(false)}
        onConfirm={handleRevokeConfirm}
        isSubmitting={isRevoking}
      />

      <ArchiveReviewDialog
        open={archiveDialogOpen}
        storyTitle={story.title_vi}
        onClose={() => setArchiveDialogOpen(false)}
        onConfirm={handleArchiveConfirm}
        isSubmitting={isArchiving}
      />

      <EditKhmerTitleDialog
        open={editTitleDialogOpen}
        initialTitle={story.title_km || ''}
        onClose={() => setEditTitleDialogOpen(false)}
        onConfirm={handleSaveTitleKm}
        isSubmitting={isSavingTitle}
      />
    </StoryWorkflowShell>
  );
}
