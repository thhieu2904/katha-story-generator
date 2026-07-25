'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  fetchReviewState,
  editKhmerTitle,
  editKhmerPage,
  approvePage,
  rejectPage,
  completeReview,
} from './api';
import { POLL_INTERVAL_MS } from './constants';
import type { ReviewState } from './types';

function messageFromReason(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError) {
    if (reason.status === 404) return 'Không tìm thấy truyện hoặc trang.';
    if (reason.status === 409) return 'Dữ liệu đã thay đổi bởi người khác. Vui lòng thử lại.';
    if (reason.status === 422) return 'Dữ liệu không hợp lệ.';
  }
  return reason instanceof Error ? reason.message : fallback;
}

export function useStoryReview(storyId: number) {
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [editingPageId, setEditingPageId] = useState<number | null>(null);

  const requestSeqRef = useRef(0);

  const beginRequest = useCallback(() => {
    requestSeqRef.current += 1;
    return requestSeqRef.current;
  }, []);

  const isCurrentRequest = useCallback((seq: number) => {
    return seq === requestSeqRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const seq = beginRequest();
    setLoading(true);
    setError(null);
    try {
      const state = await fetchReviewState(storyId);
      if (isCurrentRequest(seq)) {
        setReviewState(state);
      }
    } catch (reason) {
      if (isCurrentRequest(seq)) {
        setError(messageFromReason(reason, 'Không thể tải trạng thái duyệt.'));
      }
    } finally {
      if (isCurrentRequest(seq)) {
        setLoading(false);
      }
    }
  }, [storyId, beginRequest, isCurrentRequest]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (!reviewState?.job?.is_running) {
      return;
    }
    
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;

    const scheduleNextPoll = () => {
      if (active) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      const seq = beginRequest();
      controller = new AbortController();
      try {
        const state = await fetchReviewState(storyId, controller.signal);
        if (!active || !isCurrentRequest(seq)) return;
        
        setReviewState(state);
        setPollError(null);
        
        if (state.job?.is_running) {
          scheduleNextPoll();
        }
      } catch (reason) {
        if (!active || !isCurrentRequest(seq)) return;
        if (reason instanceof Error && reason.name === 'AbortError') return;
        
        if (reason instanceof ApiError && reason.status === 409) {
          void refresh();
          return;
        }

        setPollError(messageFromReason(reason, 'Lỗi cập nhật trạng thái tự động.'));
        scheduleNextPoll();
      }
    };

    scheduleNextPoll();

    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [reviewState?.job?.is_running, storyId, beginRequest, isCurrentRequest, refresh]);

  const handleConflict = async () => {
    setError('Dữ liệu không đồng bộ. Đang tải lại trạng thái mới nhất...');
    await refresh();
  };

  const handleEditKhmerTitle = async (textKm: string, expectedRevision: number) => {
    if (mutating) return false;
    const seq = beginRequest();
    setMutating(true);
    setError(null);
    try {
      const state = await editKhmerTitle(storyId, textKm, expectedRevision);
      if (isCurrentRequest(seq)) {
        setReviewState(state);
      }
      return true;
    } catch (reason) {
      if (!isCurrentRequest(seq)) return false;
      if (reason instanceof ApiError && reason.status === 409) {
        await handleConflict();
      } else {
        setError(messageFromReason(reason, 'Không thể cập nhật tiêu đề tiếng Khmer.'));
      }
      return false;
    } finally {
      if (isCurrentRequest(seq)) setMutating(false);
    }
  };

  const handleEditKhmerPage = async (pageId: number, textKm: string, expectedRevision: number) => {
    if (mutating) return false;
    const seq = beginRequest();
    setMutating(true);
    setError(null);
    try {
      const state = await editKhmerPage(storyId, pageId, textKm, expectedRevision);
      if (isCurrentRequest(seq)) {
        setReviewState(state);
      }
      return true;
    } catch (reason) {
      if (!isCurrentRequest(seq)) return false;
      if (reason instanceof ApiError && reason.status === 409) {
        await handleConflict();
      } else {
        setError(messageFromReason(reason, 'Không thể cập nhật nội dung tiếng Khmer.'));
      }
      return false;
    } finally {
      if (isCurrentRequest(seq)) setMutating(false);
    }
  };

  const handleApprovePage = async (
    pageId: number,
    params: {
      acknowledgeKhmerWarnings: boolean;
      expectedTextRevision: number;
      expectedReviewStatus: string;
      expectedImageAttemptCount: number;
      expectedImageUrl: string;
    }
  ) => {
    if (mutating) return false;
    const seq = beginRequest();
    setMutating(true);
    setError(null);
    try {
      const state = await approvePage(storyId, pageId, params);
      if (isCurrentRequest(seq)) {
        setReviewState(state);
      }
      return true;
    } catch (reason) {
      if (!isCurrentRequest(seq)) return false;
      if (reason instanceof ApiError && reason.status === 409) {
        await handleConflict();
      } else {
        setError(messageFromReason(reason, 'Không thể duyệt trang.'));
      }
      return false;
    } finally {
      if (isCurrentRequest(seq)) setMutating(false);
    }
  };

  const handleRejectPage = async (
    pageId: number,
    params: {
      reason: string;
      expectedTextRevision: number;
      expectedReviewStatus: string;
      expectedImageAttemptCount: number;
      expectedImageUrl: string;
    }
  ) => {
    if (mutating) return false;
    const seq = beginRequest();
    setMutating(true);
    setError(null);
    try {
      const state = await rejectPage(storyId, pageId, params);
      if (isCurrentRequest(seq)) {
        setReviewState(state);
      }
      return true;
    } catch (reason) {
      if (!isCurrentRequest(seq)) return false;
      if (reason instanceof ApiError && reason.status === 409) {
        await handleConflict();
      } else {
        setError(messageFromReason(reason, 'Không thể từ chối trang.'));
      }
      return false;
    } finally {
      if (isCurrentRequest(seq)) setMutating(false);
    }
  };

  const handleCompleteReview = async (expectedRevision: number) => {
    if (mutating) return false;
    const seq = beginRequest();
    setMutating(true);
    setError(null);
    try {
      const state = await completeReview(storyId, expectedRevision);
      if (isCurrentRequest(seq)) {
        setReviewState(state);
      }
      return true;
    } catch (reason) {
      if (!isCurrentRequest(seq)) return false;
      if (reason instanceof ApiError && reason.status === 409) {
        await handleConflict();
      } else {
        setError(messageFromReason(reason, 'Không thể hoàn tất duyệt truyện.'));
      }
      return false;
    } finally {
      if (isCurrentRequest(seq)) setMutating(false);
    }
  };

  return {
    reviewState,
    loading,
    error,
    pollError,
    mutating,
    editingPageId,
    setEditingPageId,
    refresh,
    handleEditKhmerTitle,
    handleEditKhmerPage,
    handleApprovePage,
    handleRejectPage,
    handleCompleteReview,
  };
}
