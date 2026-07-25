import { apiFetch } from '@/lib/api';
import type { ReviewState } from './types';

export function fetchReviewState(storyId: number, signal?: AbortSignal) {
  return apiFetch<ReviewState>(`/api/stories/${storyId}/review`, { signal });
}

export function editKhmerTitle(
  storyId: number,
  textKm: string,
  expectedTextRevision: number,
) {
  return apiFetch<ReviewState>(`/api/stories/${storyId}/review/title-km`, {
    method: 'PATCH',
    body: JSON.stringify({
      text_km: textKm,
      expected_text_revision: expectedTextRevision,
    }),
  });
}

export function editKhmerPage(
  storyId: number,
  pageId: number,
  textKm: string,
  expectedTextRevision: number,
) {
  return apiFetch<ReviewState>(
    `/api/stories/${storyId}/pages/${pageId}/review/text-km`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        text_km: textKm,
        expected_text_revision: expectedTextRevision,
      }),
    },
  );
}

export function approvePage(
  storyId: number,
  pageId: number,
  params: {
    acknowledgeKhmerWarnings: boolean;
    expectedTextRevision: number;
    expectedReviewStatus: string;
    expectedImageAttemptCount: number;
    expectedImageUrl: string;
  },
) {
  return apiFetch<ReviewState>(
    `/api/stories/${storyId}/pages/${pageId}/review`,
    {
      method: 'PUT',
      body: JSON.stringify({
        decision: 'approve',
        acknowledge_khmer_warnings: params.acknowledgeKhmerWarnings,
        expected_text_revision: params.expectedTextRevision,
        expected_review_status: params.expectedReviewStatus,
        expected_image_attempt_count: params.expectedImageAttemptCount,
        expected_image_url: params.expectedImageUrl,
      }),
    },
  );
}

export function rejectPage(
  storyId: number,
  pageId: number,
  params: {
    reason: string;
    expectedTextRevision: number;
    expectedReviewStatus: string;
    expectedImageAttemptCount: number;
    expectedImageUrl: string;
  },
) {
  return apiFetch<ReviewState>(
    `/api/stories/${storyId}/pages/${pageId}/review`,
    {
      method: 'PUT',
      body: JSON.stringify({
        decision: 'reject',
        reason: params.reason,
        expected_text_revision: params.expectedTextRevision,
        expected_review_status: params.expectedReviewStatus,
        expected_image_attempt_count: params.expectedImageAttemptCount,
        expected_image_url: params.expectedImageUrl,
      }),
    },
  );
}

export function completeReview(
  storyId: number,
  expectedTextRevision: number,
) {
  return apiFetch<ReviewState>(
    `/api/stories/${storyId}/complete-review`,
    {
      method: 'POST',
      body: JSON.stringify({
        expected_text_revision: expectedTextRevision,
      }),
    },
  );
}

export function regeneratePageImage(
  storyId: number,
  pageId: number,
  params: {
    expectedTextRevision: number;
    expectedReviewStatus: string;
    expectedImageAttemptCount: number;
    expectedImageUrl: string;
  },
) {
  return apiFetch<{ job_id: string; already_running: boolean; active_page_id: number }>(
    `/api/stories/${storyId}/pages/${pageId}/regenerate-image`,
    {
      method: 'POST',
      body: JSON.stringify({
        expected_text_revision: params.expectedTextRevision,
        expected_review_status: params.expectedReviewStatus,
        expected_image_attempt_count: params.expectedImageAttemptCount,
        expected_image_url: params.expectedImageUrl,
      }),
    },
  );
}

export function publishStory(storyId: number, expectedTextRevision: number, expectedShareRevision: number) {
  return apiFetch<ReviewState>(`/api/stories/${storyId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expected_text_revision: expectedTextRevision, expected_share_revision: expectedShareRevision }),
  });
}

export function revokeShare(storyId: number, expectedShareRevision: number) {
  return apiFetch<ReviewState>(`/api/stories/${storyId}/share-link/revoke`, {
    method: 'POST',
    body: JSON.stringify({ expected_share_revision: expectedShareRevision }),
  });
}

export function createShareLink(storyId: number, expectedShareRevision: number) {
  return apiFetch<ReviewState>(`/api/stories/${storyId}/share-link`, {
    method: 'POST',
    body: JSON.stringify({ expected_share_revision: expectedShareRevision }),
  });
}

export function archiveStory(storyId: number, expectedStatus: string, expectedShareRevision: number) {
  return apiFetch<ReviewState>(`/api/stories/${storyId}/archive`, {
    method: 'POST',
    body: JSON.stringify({ expected_status: expectedStatus, expected_share_revision: expectedShareRevision }),
  });
}
