'use client';

// TEMPORARY dev-only preview harness for UI review. Delete before ship.

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { useIsMobileCompact } from '@/features/story-workflow/useIsMobileCompact';
import { ReviewProgress as ReviewProgressBar } from '@/features/story-review/components/ReviewProgress';
import { ReviewPageCard } from '@/features/story-review/components/ReviewPageCard';
import { ShareLinkPanel } from '@/features/story-review/components/ShareLinkPanel';
import { CompleteReviewDialog } from '@/features/story-review/components/CompleteReviewDialog';
import { PublishStoryDialog } from '@/features/story-review/components/PublishStoryDialog';
import { StopSharingDialog } from '@/features/story-review/components/StopSharingDialog';
import { ArchiveReviewDialog } from '@/features/story-review/components/ArchiveReviewDialog';
import { EditKhmerTitleDialog } from '@/features/story-review/components/EditKhmerTitleDialog';
import { RejectPageDialog } from '@/features/story-review/components/RejectPageDialog';
import { RegenerateImageDialog } from '@/features/story-review/components/RegenerateImageDialog';
import { ApproveWarningDialog } from '@/features/story-review/components/ApproveWarningDialog';
import { STORY_STATUS_LABELS } from '@/features/story-review/constants';
import type {
  ReviewPageData,
  ReviewState,
} from '@/features/story-review/types';
import { StoryReader } from '@/features/reader/components/StoryReader';
import { KathaLogo } from '@/components/layout/KathaLogo';
import { ReaderPage } from '@/features/reader/components/ReaderPage';
import { ReaderControls } from '@/features/reader/components/ReaderControls';
import { ReaderLanguageToggle } from '@/features/reader/components/ReaderLanguageToggle';
import type { PublicStory, ReaderLanguage } from '@/features/reader/types';
import mockData from './mock-data.json';

const noopAsync = async () => {};
const noopBool = async () => true;

function buildPages(): ReviewPageData[] {
  const raw = mockData.pages;
  const base = (p: (typeof raw)[number]): ReviewPageData => ({
    id: p.id,
    page_no: p.page_no,
    text_km: p.text_km,
    text_vi: p.text_vi,
    spellcheck_flags: [],
    khmer_validated_at: '2026-07-25T10:00:00Z',
    image_url: p.image_url,
    image_status: 'completed',
    image_attempt_count: 1,
    image_error_code: null,
    review_status: 'pending',
    review_notes: null,
    reviewed_at: null,
    can_approve: true,
    can_reject: true,
    can_regenerate: false,
  });
  const pages = raw.map(base);
  // Page 1: approved
  pages[0] = { ...pages[0], review_status: 'approved', reviewed_at: '2026-07-25T11:00:00Z' };
  // Page 2: pending with Khmer warning (not yet validated)
  pages[1] = { ...pages[1], khmer_validated_at: null };
  // Page 3: rejected with notes, regen available
  pages[2] = {
    ...pages[2],
    review_status: 'rejected',
    review_notes: 'Nhân vật Srey trong ảnh không khớp reference — tóc quá dài và trang phục sai màu.',
    can_regenerate: true,
  };
  // Page 4: no image (failed)
  pages[3] = { ...pages[3], image_url: null, image_status: 'failed', image_error_code: 'PROVIDER_ERROR', can_approve: false, can_reject: false };
  return pages;
}

function buildReviewState(status: string, jobRunningOn: number | null): ReviewState {
  const pages = buildPages();
  const readOnly = status === 'approved' || status === 'published';
  return {
    story: {
      id: 1,
      title_vi: mockData.story.title_vi,
      title_km: mockData.story.title_km,
      status,
      text_revision: 4,
      target_age: mockData.story.target_age,
      genre: { id: 1, name_vi: 'Cổ tích', name_en: 'Fairy tale' },
      published_at: status === 'published' ? '2026-07-26T09:00:00Z' : null,
    },
    progress: {
      total: pages.length,
      pending: pages.filter((p) => p.review_status === 'pending').length,
      approved: pages.filter((p) => p.review_status === 'approved').length,
      rejected: pages.filter((p) => p.review_status === 'rejected').length,
    },
    job: {
      kind: jobRunningOn ? 'review_regeneration' : null,
      active_page_id: jobRunningOn,
      is_running: !!jobRunningOn,
      is_stale: false,
      can_resume: false,
    },
    share: {
      active: status === 'published',
      revision: 2,
      token: status === 'published' ? 'mockTokenABC123' : null,
      path: status === 'published' ? '/stories/mockTokenABC123' : null,
      activated_at: status === 'published' ? '2026-07-26T09:00:00Z' : null,
      revoked_at: null,
    },
    capabilities: {
      can_edit_khmer: !readOnly,
      can_review_pages: !readOnly,
      can_complete_review: !readOnly,
      can_publish: status === 'approved',
      can_create_share_link: status === 'published',
      can_revoke_share_link: status === 'published',
      can_archive: true,
      read_only: readOnly,
    },
    pages,
  };
}

function MockReviewWorkspace({
  status,
  jobRunningOn,
}: {
  status: string;
  jobRunningOn: number | null;
}) {
  const isMobileCompact = useIsMobileCompact();
  const [editingPageId, setEditingPageId] = useState<number | null>(null);
  const reviewState = buildReviewState(status, jobRunningOn);
  const { story, pages, progress, capabilities, job } = reviewState;
  const showKhmerValidatorCta =
    capabilities.can_review_pages &&
    pages.some((p) => !p.khmer_validated_at || p.spellcheck_flags.length > 0);
  const statusLabel = STORY_STATUS_LABELS[story.status] || story.status;

  const STATUS_BADGE_STYLES: Record<string, string> = {
    pending_review: 'bg-katha-warning/10 text-amber-300 border-katha-warning/20',
    generating_images: 'bg-katha-primary/10 text-katha-primary-light border-katha-primary/20',
    approved: 'bg-katha-success/10 text-emerald-300 border-katha-success/20',
    published: 'bg-katha-success/10 text-emerald-300 border-katha-success/20',
  };
  const statusStyle = STATUS_BADGE_STYLES[story.status] || STATUS_BADGE_STYLES.pending_review;

  let actionBar = null;
  if (story.status === 'pending_review') {
    actionBar = (
      <>
        <div className="text-xs text-white/50 hidden sm:block">
          {capabilities.can_complete_review && progress.pending === 0 && progress.rejected === 0
            ? 'Tất cả trang đã được duyệt.'
            : `Còn ${progress.pending} trang chờ duyệt${
                progress.rejected > 0 ? `, ${progress.rejected} trang bị từ chối` : ''
              }.`}
        </div>
        <button
          type="button"
          disabled={progress.pending > 0 || progress.rejected > 0}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          Hoàn tất duyệt truyện
        </button>
      </>
    );
  } else if (story.status === 'approved') {
    actionBar = (
      <>
        <div className="text-xs text-white/50 hidden sm:block">
          Truyện đã được duyệt, sẵn sàng xuất bản.
        </div>
        <button
          type="button"
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light"
        >
          Xuất bản và tạo liên kết
        </button>
      </>
    );
  } else if (story.status === 'published') {
    actionBar = (
      <>
        <div className="text-xs text-white/50">
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
      storyKey={'s1_UkLWZg9D' as never}
      storyTitle={story.title_vi || 'Truyện chưa đặt tên'}
      status={story.status}
      imageWorkflowKind={job.kind}
      actionBar={actionBar}
    >
      {showKhmerValidatorCta && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <span>Văn bản Khmer chưa được kiểm tra hoặc vẫn còn cảnh báo kỹ thuật.</span>
          <button className="shrink-0 rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium hover:bg-amber-500/30">
            Chạy lại kiểm tra Khmer
          </button>
        </div>
      )}

      {job.is_running && (
        <div className="mb-6 p-4 rounded-xl bg-katha-primary/10 border border-katha-primary/20 text-blue-200 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-katha-primary-light" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Đang tạo bản thay thế ảnh. Các thao tác duyệt tạm bị tắt.</span>
        </div>
      )}

      <div className="mb-8 space-y-6">
        <div className="bg-katha-surface-light rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyle}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel}
            </span>
            {capabilities.read_only && <span className="text-xs text-gray-400">Chỉ đọc</span>}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-khmer text-white">{story.title_km || 'Chưa có tiêu đề Khmer'}</h2>
              </div>
              <p className="text-sm text-gray-400">{story.title_vi || 'Truyện chưa đặt tên'}</p>
            </div>
            <ReviewProgressBar progress={progress} />
          </div>
        </div>
      </div>

      {isMobileCompact && (
        <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm text-center">
          Mở trên tablet hoặc máy tính để chỉnh sửa chi tiết
        </div>
      )}

      {story.status === 'published' && (
        <div className="mb-8">
          <ShareLinkPanel
            share={reviewState.share}
            capabilities={capabilities}
            storyTitle={story.title_vi}
            onRevokeShare={() => {}}
            onCreateShareLink={() => {}}
            onArchive={() => {}}
            disabled={false}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pages.map((page) => (
          <ReviewPageCard
            key={page.id}
            page={page}
            reviewState={reviewState}
            isMobileCompact={isMobileCompact}
            disabled={job.is_running}
            isEditing={editingPageId === page.id}
            onEditStart={() => setEditingPageId(page.id)}
            onEditCancel={() => setEditingPageId(null)}
            onEditSave={noopAsync}
            onApprove={noopBool}
            onReject={noopBool}
            onRegenerate={noopBool}
            isMutating={false}
          />
        ))}
      </div>
    </StoryWorkflowShell>
  );
}

function DialogPreview({ kind }: { kind: string }) {
  const progress = { total: 6, pending: 0, approved: 5, rejected: 1 };
  return (
    <div className="min-h-screen bg-katha-surface">
      <CompleteReviewDialog open={kind === 'complete'} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} progress={progress} />
      <PublishStoryDialog open={kind === 'publish'} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} />
      <StopSharingDialog open={kind === 'revoke'} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} />
      <ArchiveReviewDialog open={kind === 'archive'} storyTitle={mockData.story.title_vi} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} />
      <EditKhmerTitleDialog open={kind === 'edit-title'} initialTitle={mockData.story.title_km || ''} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} />
      <RejectPageDialog open={kind === 'reject'} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} />
      <RegenerateImageDialog open={kind === 'regen'} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} pageNo={3} />
      <ApproveWarningDialog open={kind === 'approve-warning'} pageNo={2} onClose={() => {}} onConfirm={noopAsync} isSubmitting={false} />
    </div>
  );
}

function PreviewInner() {
  const params = useSearchParams();
  const view = params.get('view') || 'review';

  if (view === 'reader') {
    const story: PublicStory = {
      title_km: mockData.story.title_km,
      title_vi: mockData.story.title_vi,
      target_age: mockData.story.target_age,
      page_count: mockData.pages.length,
      cover: { background_url: null },
      pages: mockData.pages.map((p) => ({
        page_no: p.page_no,
        text_km: p.text_km,
        text_vi: p.text_vi,
        image_url: p.image_url,
      })),
    };
    return <StoryReader story={story} />;
  }

  if (view === 'reader-page') {
    const lang = (params.get('lang') || 'km') as ReaderLanguage;
    const pageNo = Number(params.get('page') || '2');
    const p = mockData.pages[pageNo - 1];
    const headerTitle = lang === 'km' ? mockData.story.title_km : mockData.story.title_vi;
    return (
      <div className="min-h-screen bg-katha-surface text-gray-100 flex flex-col font-sans">
        <header className="absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/50 to-transparent">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <KathaLogo height={42} className="-my-2" />
              <span className="shrink-0 text-sm font-semibold tracking-wide text-white/85">
                Katha{' '}
                <span lang="km" className="font-khmer font-normal text-white/55">
                  កថា
                </span>
              </span>
              <span className="hidden text-white/25 sm:inline" aria-hidden>
                ·
              </span>
              <span
                lang={lang}
                className={`hidden truncate text-sm text-white/60 sm:inline ${lang === 'km' ? 'font-khmer' : ''}`}
              >
                {headerTitle}
              </span>
            </div>
            <ReaderLanguageToggle language={lang} onChange={() => {}} />
          </div>
        </header>
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 pb-4 pt-20 md:px-6 lg:px-8 flex flex-col justify-center">
          <ReaderPage
            page={{ page_no: p.page_no, text_km: p.text_km, text_vi: p.text_vi, image_url: p.image_url }}
            language={lang}
            storyTitle={mockData.story.title_km || ''}
          />
        </main>
        <ReaderControls currentPage={pageNo} totalPages={mockData.pages.length} onPageChange={() => {}} />
      </div>
    );
  }

  if (view.startsWith('dialog-')) {
    return <DialogPreview kind={view.slice('dialog-'.length)} />;
  }

  if (view === 'review-published') {
    return <MockReviewWorkspace status="published" jobRunningOn={null} />;
  }
  if (view === 'review-approved') {
    return <MockReviewWorkspace status="approved" jobRunningOn={null} />;
  }
  if (view === 'review-regen') {
    return <MockReviewWorkspace status="generating_images" jobRunningOn={mockData.pages[2].id} />;
  }
  return <MockReviewWorkspace status="pending_review" jobRunningOn={null} />;
}

export default function DevUiPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <PreviewInner />
    </Suspense>
  );
}
