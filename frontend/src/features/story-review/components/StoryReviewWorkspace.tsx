'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="h-16 bg-katha-text/5 rounded-2xl w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-96 bg-katha-text/5 rounded-2xl" />
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
    <div className="flex flex-col items-center justify-center p-12 text-center bg-katha-surface-light rounded-2xl border border-katha-text/5">
      <h3 className="text-xl font-medium text-katha-text mb-2">{title}</h3>
      {detail && <p className="text-katha-text/55 mb-6">{detail}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-katha-text/10 hover:bg-katha-text/15 text-katha-text rounded-xl font-medium transition-colors"
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
      <StoryWorkflowShell
        storyKey={storyKey}
        storyTitle={story?.title_vi || undefined}
        status={story?.status}
        imageWorkflowKind={story?.image_workflow_kind}
      >
        <WorkspaceMessage
          title="Không thể tải không gian duyệt truyện"
          detail={error || undefined}
          onRetry={retry}
        />
      </StoryWorkflowShell>
    );
  }

  return (
    <StoryReviewWorkspaceInner
      storyId={story.id}
      storyKey={storyKey}
      storyMeta={{
        title: story.title_vi,
        status: story.status,
        imageWorkflowKind: story.image_workflow_kind,
      }}
    />
  );
}

interface StoryMetaFallback {
  title: string | null;
  status: string;
  imageWorkflowKind: 'initial' | 'review_regeneration' | null;
}

function StoryReviewWorkspaceInner({
  storyId,
  storyKey,
  storyMeta,
}: {
  storyId: number;
  storyKey: StoryRouteKey;
  storyMeta: StoryMetaFallback;
}) {
  const router = useRouter();
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
    handleRunKhmerValidator,
  } = useStoryReview(storyId);

  const fallbackShellProps = {
    storyKey,
    storyTitle: storyMeta.title || 'Truyện chưa đặt tên',
    status: storyMeta.status,
    imageWorkflowKind: storyMeta.imageWorkflowKind,
  };

  if (loading && !reviewState) {
    return (
      <StoryWorkflowShell {...fallbackShellProps}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (error && !reviewState) {
    return (
      <StoryWorkflowShell {...fallbackShellProps}>
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
      <StoryWorkflowShell {...fallbackShellProps}>
        <WorkspaceMessage title="Không có dữ liệu" onRetry={refresh} />
      </StoryWorkflowShell>
    );
  }

  const { story, pages, progress, capabilities, job } = reviewState;
  const showKhmerValidatorCta =
    capabilities.can_review_pages &&
    pages.some((page) => !page.khmer_validated_at || page.spellcheck_flags.length > 0);

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
      const published = await handlePublish(story.text_revision, reviewState.share.revision);
      if (published) {
        setPublishDialogOpen(false);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRevokeConfirm = async () => {
    try {
      setIsRevoking(true);
      const revoked = await handleRevokeShare(reviewState.share.revision);
      if (revoked) {
        setRevokeDialogOpen(false);
      }
    } finally {
      setIsRevoking(false);
    }
  };

  const handleArchiveConfirm = async () => {
    try {
      setIsArchiving(true);
      const archived = await handleArchive(story.status, reviewState.share.revision);
      if (archived) {
        setArchiveDialogOpen(false);
        router.replace('/admin/stories?notice=archived');
      }
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
    return handleApprovePage(page.id, {
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
    return handleRejectPage(page.id, {
      reason,
      expectedTextRevision: story.text_revision,
      expectedReviewStatus: page.review_status,
      expectedImageAttemptCount: page.image_attempt_count,
      expectedImageUrl: page.image_url || '',
    });
  };

  const handlePageRegenerate = async (page: ReviewPageData) => {
    return handleRegenerateImage(page.id, {
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
  if (story.status === 'generating_images') {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/50">
          Đang tạo bản thay thế ảnh. Các thao tác duyệt tạm bị tắt.
        </div>
        <button
          type="button"
          disabled
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition disabled:opacity-40"
        >
          Hoàn tất duyệt truyện
        </button>
      </>
    );
  } else if (story.status === 'pending_review') {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/50 hidden sm:block">
          {capabilities.can_complete_review
            ? 'Tất cả trang đã được duyệt.'
            : `Còn ${progress.pending} trang chờ duyệt${
                progress.rejected > 0 ? `, ${progress.rejected} trang bị từ chối` : ''
              }.`}
        </div>
        <button
          type="button"
          onClick={() => setCompleteDialogOpen(true)}
          disabled={!capabilities.can_complete_review || mutating || isCompleting}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          Hoàn tất duyệt truyện
        </button>
      </>
    );
  } else if (story.status === 'approved') {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/50 hidden sm:block">
          Truyện đã được duyệt, sẵn sàng xuất bản.
        </div>
        <button
          type="button"
          onClick={() => setPublishDialogOpen(true)}
          disabled={!capabilities.can_publish || mutating || isPublishing}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          Xuất bản và tạo liên kết
        </button>
      </>
    );
  } else if (story.status === 'published') {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/50">
          Truyện đã xuất bản. Quản lý liên kết chia sẻ ở phía trên.
        </div>
        <button
          type="button"
          disabled
          className="rounded-xl bg-katha-success/20 border border-katha-success/30 px-5 py-2.5 text-xs font-semibold text-emerald-200"
        >
          Đã xuất bản
        </button>
      </>
    );
  }

  return (
    <StoryWorkflowShell
      storyKey={storyKey}
      storyTitle={story.title_vi || 'Truyện chưa đặt tên'}
      status={story.status}
      imageWorkflowKind={job.kind}
      actionBar={actionBar}
    >
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

      {showKhmerValidatorCta && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <span>Văn bản Khmer chưa được kiểm tra hoặc vẫn còn cảnh báo kỹ thuật.</span>
          <button
            type="button"
            onClick={() => void handleRunKhmerValidator(story.text_revision)}
            disabled={mutating || isJobRunning}
            className="shrink-0 rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium hover:bg-amber-500/30 disabled:opacity-50"
          >
            Chạy lại kiểm tra Khmer
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
        <div className="bg-katha-surface-light rounded-2xl p-5 border border-katha-text/5">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyle}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
            {capabilities.read_only && (
              <span className="text-xs text-katha-text/55">Chỉ đọc</span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-khmer text-katha-text">
                  {story.title_km || 'Chưa có tiêu đề Khmer'}
                </h2>
                {capabilities.can_edit_khmer && !isMobileCompact && (
                  <button
                    onClick={() => setEditTitleDialogOpen(true)}
                    disabled={mutating}
                    className="p-1.5 text-katha-text/55 hover:text-katha-text bg-katha-text/5 hover:bg-katha-text/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Sửa tiêu đề Khmer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-sm text-katha-text/55">
                {story.title_vi || 'Truyện chưa đặt tên'}
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
