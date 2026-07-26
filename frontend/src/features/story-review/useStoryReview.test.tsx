import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { fetchStory } from '@/features/stories/api';
import * as api from './api';
import type { ReviewState } from './types';
import { useStoryReview } from './useStoryReview';

vi.mock('@/features/stories/api', () => ({ fetchStory: vi.fn() }));

vi.mock('./api', () => ({
  fetchReviewState: vi.fn(),
  editKhmerTitle: vi.fn(),
  editKhmerPage: vi.fn(),
  approvePage: vi.fn(),
  rejectPage: vi.fn(),
  completeReview: vi.fn(),
  regeneratePageImage: vi.fn(),
  publishStory: vi.fn(),
  revokeShare: vi.fn(),
  createShareLink: vi.fn(),
  archiveStory: vi.fn(),
  runKhmerValidator: vi.fn(),
}));

function state(status = 'pending_review'): ReviewState {
  return {
    story: {
      id: 10,
      title_vi: 'Truyện kiểm thử',
      title_km: 'រឿងសាកល្បង',
      status,
      text_revision: 3,
      target_age: 'preschool',
      genre: null,
      published_at: null,
    },
    progress: { total: 1, pending: 1, approved: 0, rejected: 0 },
    job: {
      kind: status === 'generating_images' ? 'review_regeneration' : null,
      active_page_id: status === 'generating_images' ? 101 : null,
      is_running: false,
      is_stale: false,
      can_resume: false,
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
      can_edit_khmer: status === 'pending_review',
      can_review_pages: status === 'pending_review',
      can_complete_review: false,
      can_publish: false,
      can_create_share_link: false,
      can_revoke_share_link: false,
      can_archive: true,
      read_only: status !== 'pending_review',
    },
    pages: [{
      id: 101,
      page_no: 1,
      text_km: 'ទំព័រ។',
      text_vi: 'Trang.',
      spellcheck_flags: [],
      khmer_validated_at: null,
      image_url: 'https://assets.example.test/page.webp',
      image_status: 'completed',
      image_attempt_count: 1,
      image_error_code: null,
      review_status: 'rejected',
      review_notes: 'Đổi bố cục',
      reviewed_at: null,
      can_approve: true,
      can_reject: true,
      can_regenerate: true,
    }],
  };
}

describe('useStoryReview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('installs the canonical review state returned by regeneration', async () => {
    const initial = state();
    const generating = state('generating_images');
    vi.mocked(api.fetchReviewState).mockResolvedValue(initial);
    vi.mocked(api.regeneratePageImage).mockResolvedValue({
      already_running: false,
      review: generating,
    });
    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));

    await act(async () => {
      await result.current.handleRegenerateImage(101, {
        expectedTextRevision: 3,
        expectedReviewStatus: 'rejected',
        expectedImageAttemptCount: 1,
        expectedImageUrl: 'https://assets.example.test/page.webp',
      });
    });
    expect(result.current.reviewState).toEqual(generating);
    expect(api.fetchReviewState).toHaveBeenCalledTimes(1);
  });

  it('does not install StoryResponse as ReviewState after archive', async () => {
    const initial = state();
    vi.mocked(api.fetchReviewState).mockResolvedValue(initial);
    vi.mocked(api.archiveStory).mockResolvedValue({ status: 'archived' } as never);
    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handleArchive('pending_review', 0)).toBe(true);
    });
    expect(result.current.reviewState).toEqual(initial);
  });

  it('reruns Khmer validation and installs a fresh canonical review state', async () => {
    const initial = state();
    const validated = state();
    validated.pages[0].khmer_validated_at = '2026-07-26T00:00:00Z';
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(validated);
    vi.mocked(api.runKhmerValidator).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handleRunKhmerValidator(3)).toBe(true);
    });
    expect(result.current.reviewState).toEqual(validated);
  });

  it('reconciles a lost publish ACK with one canonical reread instead of retrying', async () => {
    const initial = state('approved');
    const published = state('published');
    published.share = {
      active: true,
      revision: 1,
      token: 'a'.repeat(43),
      path: '/stories/' + 'a'.repeat(43),
      activated_at: '2026-07-26T00:00:00Z',
      revoked_at: null,
    };
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(published);
    vi.mocked(api.publishStory).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handlePublish(3, 0)).toBe(true);
    });

    expect(api.publishStory).toHaveBeenCalledOnce();
    expect(api.fetchReviewState).toHaveBeenCalledTimes(2);
    expect(result.current.reviewState).toEqual(published);
    expect(result.current.error).toBeNull();
  });

  it('reconciles a lost revoke ACK with one canonical reread instead of retrying', async () => {
    const initial = state('published');
    initial.share.active = true;
    initial.share.token = 'a'.repeat(43);
    const revoked = state('published');
    revoked.share = {
      active: false,
      revision: 2,
      token: null,
      path: null,
      activated_at: '2026-07-26T00:00:00Z',
      revoked_at: '2026-07-26T00:01:00Z',
    };
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(revoked);
    vi.mocked(api.revokeShare).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handleRevokeShare(1)).toBe(true);
    });

    expect(api.revokeShare).toHaveBeenCalledOnce();
    expect(api.fetchReviewState).toHaveBeenCalledTimes(2);
    expect(result.current.reviewState).toEqual(revoked);
  });

  it('reconciles a lost re-share ACK with one canonical reread instead of retrying', async () => {
    const initial = state('published');
    initial.share.active = false;
    const reshared = state('published');
    reshared.share = {
      active: true,
      revision: 3,
      token: 'b'.repeat(43),
      path: '/stories/' + 'b'.repeat(43),
      activated_at: '2026-07-26T00:02:00Z',
      revoked_at: null,
    };
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(reshared);
    vi.mocked(api.createShareLink).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handleCreateShareLink(2)).toBe(true);
    });

    expect(api.createShareLink).toHaveBeenCalledOnce();
    expect(api.fetchReviewState).toHaveBeenCalledTimes(2);
    expect(result.current.reviewState).toEqual(reshared);
  });

  it('reconciles a lost regeneration ACK with one canonical reread instead of retrying', async () => {
    const initial = state();
    const generating = state('generating_images');
    generating.job.is_running = true;
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(generating);
    vi.mocked(api.regeneratePageImage).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(
        await result.current.handleRegenerateImage(101, {
          expectedTextRevision: 3,
          expectedReviewStatus: 'rejected',
          expectedImageAttemptCount: 1,
          expectedImageUrl: 'https://assets.example.test/page.webp',
        }),
      ).toBe(true);
    });

    expect(api.regeneratePageImage).toHaveBeenCalledOnce();
    expect(api.fetchReviewState).toHaveBeenCalledTimes(2);
    expect(result.current.reviewState).toEqual(generating);
    expect(result.current.error).toBeNull();
  });

  it('keeps the error banner when a lost publish ACK reconciles to not-applied', async () => {
    const initial = state('approved');
    const stillApproved = state('approved');
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(stillApproved);
    vi.mocked(api.publishStory).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handlePublish(3, 0)).toBe(false);
    });

    expect(api.fetchReviewState).toHaveBeenCalledTimes(2);
    expect(result.current.reviewState).toEqual(stillApproved);
    expect(result.current.error).toContain('Trạng thái mới nhất đã được tải lại.');
  });

  it('treats a finished regeneration as applied when the page attempt count moved on', async () => {
    const initial = state();
    const finished = state();
    finished.pages[0].image_attempt_count = 2;
    finished.pages[0].image_url = 'https://assets.example.test/new.webp';
    finished.pages[0].review_status = 'pending';
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(finished);
    vi.mocked(api.regeneratePageImage).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(
        await result.current.handleRegenerateImage(101, {
          expectedTextRevision: 3,
          expectedReviewStatus: 'rejected',
          expectedImageAttemptCount: 1,
          expectedImageUrl: 'https://assets.example.test/page.webp',
        }),
      ).toBe(true);
    });

    expect(result.current.error).toBeNull();
  });

  it('keeps the regeneration error when the job belongs to another page and the target is unchanged', async () => {
    const initial = state();
    const otherPageJob = state('generating_images');
    otherPageJob.job.is_running = true;
    otherPageJob.job.active_page_id = 102;
    vi.mocked(api.fetchReviewState)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(otherPageJob);
    vi.mocked(api.regeneratePageImage).mockRejectedValue(new ApiError('Timeout', 0));

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(
        await result.current.handleRegenerateImage(101, {
          expectedTextRevision: 3,
          expectedReviewStatus: 'rejected',
          expectedImageAttemptCount: 1,
          expectedImageUrl: 'https://assets.example.test/page.webp',
        }),
      ).toBe(false);
    });

    expect(result.current.error).toContain('Trạng thái mới nhất đã được tải lại.');
  });

  it('confirms archive through the canonical story read after a lost ACK', async () => {
    const initial = state();
    vi.mocked(api.fetchReviewState).mockResolvedValueOnce(initial);
    vi.mocked(api.archiveStory).mockRejectedValue(new ApiError('Timeout', 0));
    vi.mocked(fetchStory).mockResolvedValue({ status: 'archived' } as never);

    const { result } = renderHook(() => useStoryReview(10));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => {
      expect(await result.current.handleArchive('pending_review', 0)).toBe(true);
    });

    expect(api.archiveStory).toHaveBeenCalledOnce();
    expect(fetchStory).toHaveBeenCalledWith(10);
    expect(api.fetchReviewState).toHaveBeenCalledTimes(1);
  });
});
