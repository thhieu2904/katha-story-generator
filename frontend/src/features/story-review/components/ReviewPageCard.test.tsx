import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewPageData, ReviewState } from '../types';
import { ReviewPageCard } from './ReviewPageCard';

const page: ReviewPageData = {
  id: 101,
  page_no: 1,
  text_km: 'ទំព័រសាកល្បង។',
  text_vi: 'Trang thử nghiệm.',
  spellcheck_flags: [],
  khmer_validated_at: '2026-07-26T00:00:00Z',
  image_url: 'https://assets.example.test/old.webp',
  image_status: 'generating',
  image_attempt_count: 2,
  image_error_code: null,
  review_status: 'rejected',
  review_notes: 'Cần đổi bố cục ảnh',
  reviewed_at: '2026-07-26T00:00:00Z',
  can_approve: false,
  can_reject: false,
  can_regenerate: false,
};

const staleReviewState: ReviewState = {
  story: {
    id: 10,
    title_vi: 'Truyện thử',
    title_km: 'រឿងសាកល្បង',
    status: 'generating_images',
    text_revision: 3,
    target_age: 'preschool',
    genre: null,
    published_at: null,
  },
  progress: { total: 1, pending: 0, approved: 0, rejected: 1 },
  job: {
    kind: 'review_regeneration',
    active_page_id: 101,
    is_running: false,
    is_stale: true,
    can_resume: true,
  },
  share: {
    active: false,
    revision: 0,
    token: null,
    path: null,
    activated_at: null,
    revoked_at: null,
  },
  capabilities: {
    can_edit_khmer: false,
    can_review_pages: false,
    can_complete_review: false,
    can_publish: false,
    can_create_share_link: false,
    can_revoke_share_link: false,
    can_archive: false,
    read_only: true,
  },
  pages: [page],
};

function renderCard(pageOverrides: Partial<ReviewPageData>) {
  const reviewablePage: ReviewPageData = {
    ...page,
    review_status: 'pending',
    review_notes: null,
    reviewed_at: null,
    ...pageOverrides,
  };
  const reviewState: ReviewState = {
    ...staleReviewState,
    story: { ...staleReviewState.story, status: 'pending_review' },
    job: {
      kind: null,
      active_page_id: null,
      is_running: false,
      is_stale: false,
      can_resume: false,
    },
    capabilities: {
      ...staleReviewState.capabilities,
      can_edit_khmer: true,
      can_review_pages: true,
      read_only: false,
    },
    pages: [reviewablePage],
  };
  return render(
    <ReviewPageCard
      page={reviewablePage}
      reviewState={reviewState}
      isMobileCompact={false}
      disabled={false}
      isEditing={false}
      onEditStart={vi.fn()}
      onEditCancel={vi.fn()}
      onEditSave={vi.fn().mockResolvedValue(undefined)}
      onApprove={vi.fn().mockResolvedValue(false)}
      onReject={vi.fn().mockResolvedValue(false)}
      onRegenerate={vi.fn().mockResolvedValue(true)}
      isMutating={false}
    />,
  );
}

describe('ReviewPageCard', () => {
  it('disables both review buttons when the page has no usable image', () => {
    renderCard({
      image_url: null,
      image_status: 'failed',
      can_approve: false,
      can_reject: false,
    });

    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Duyệt/ })).toBeDisabled();
  });

  it('disables both review buttons from backend capabilities even when the image itself is usable', () => {
    // Discriminates capability gating from the old image-only heuristic:
    // a completed image with a URL, but backend says not reviewable (e.g. missing text).
    renderCard({
      image_url: 'https://assets.example.test/ok.webp',
      image_status: 'completed',
      can_approve: false,
      can_reject: false,
    });

    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Duyệt/ })).toBeDisabled();
  });

  it('opens the reject dialog when the page is rejectable', () => {
    renderCard({
      image_status: 'completed',
      can_approve: true,
      can_reject: true,
    });

    const rejectButton = screen.getByRole('button', { name: 'Từ chối' });
    expect(rejectButton).toBeEnabled();
    fireEvent.click(rejectButton);
    expect(
      screen.getByRole('heading', { name: 'Từ chối trang' }),
    ).toBeInTheDocument();
  });

  it('shows stale regeneration recovery on compact mobile even when normal capability is off', () => {
    render(
      <ReviewPageCard
        page={page}
        reviewState={staleReviewState}
        isMobileCompact
        disabled={false}
        isEditing={false}
        onEditStart={vi.fn()}
        onEditCancel={vi.fn()}
        onEditSave={vi.fn().mockResolvedValue(undefined)}
        onApprove={vi.fn().mockResolvedValue(false)}
        onReject={vi.fn().mockResolvedValue(false)}
        onRegenerate={vi.fn().mockResolvedValue(true)}
        isMutating={false}
      />,
    );

    expect(page.can_regenerate).toBe(false);
    fireEvent.click(screen.getByTestId('stale-regeneration-recovery'));
    expect(
      screen.getByRole('heading', { name: 'Tạo lại ảnh minh họa' }),
    ).toBeInTheDocument();
  });
});
