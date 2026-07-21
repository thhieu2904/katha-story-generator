'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStory, fetchStoryText } from '@/features/stories/api';
import type { Story, StoryText } from '@/features/stories/types';
import { ApiError } from '@/lib/api';
import {
  addStoryPage,
  confirmStoryText,
  deleteStoryPage,
  instructionEdit,
  quickEdit,
  reorderStoryPages,
  retranslatePage,
  retranslateTitle,
  validateKhmer,
} from './api';
import type { MutationResponse, PendingOperation, QuickAction } from './types';

export function useStoryEditor(storyId: number) {
  const [story, setStory] = useState<Story | null>(null);
  const [text, setText] = useState<StoryText | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [validationFailed, setValidationFailed] = useState(false);
  const [validationRetryToken, setValidationRetryToken] = useState(0);
  const validationAttempts = useRef(new Set<number>());

  const refresh = useCallback(async () => {
    const currentStory = await fetchStory(storyId);
    setStory(currentStory);
    let canonical: StoryText | null = null;
    if (
      currentStory.status !== 'draft' &&
      currentStory.status !== 'generating_text' &&
      currentStory.status !== 'archived'
    ) {
      canonical = await fetchStoryText(storyId);
    }
    setText(canonical);
    setBlocked(false);
    return currentStory;
  }, [storyId]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void refresh()
        .then(() => {
          if (active) setError(null);
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải truyện.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (story?.status !== 'generating_text') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const current = await refresh();
        if (!active) return;
        setError(null);
        if (current.status === 'generating_text') {
          timer = setTimeout(poll, 3000);
        }
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Không thể kiểm tra trạng thái.');
        timer = setTimeout(poll, 3000);
      }
    };

    timer = setTimeout(poll, 3000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [story?.status, refresh]);

  useEffect(() => {
    if (!text || text.status !== 'text_draft' || pending || blocked) return;
    if (!text.pages.some((page) => page.khmer_validated_at === null)) return;
    if (validationAttempts.current.has(text.text_revision)) return;
    const attemptedRevision = text.text_revision;
    validationAttempts.current.add(attemptedRevision);
    setPending('validate');
    void validateKhmer(storyId, attemptedRevision)
      .then((canonical) => {
        setText(canonical);
        setValidationFailed(false);
        setNotice('Đã chạy kiểm tra kỹ thuật Khmer cho bản hiện tại.');
      })
      .catch(async (reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 409) {
          await refresh().catch(() => setBlocked(true));
          return;
        }
        if (reason instanceof ApiError && reason.status === 0) {
          try {
            await refresh();
            setError(`${reason.message} Trạng thái mới nhất đã được tải lại.`);
          } catch {
            setBlocked(true);
            setError('Chưa thể đối soát trạng thái sau lỗi kiểm tra Khmer.');
          }
        } else {
          setError(reason instanceof Error ? reason.message : 'Không thể kiểm tra Khmer.');
        }
        setValidationFailed(true);
      })
      .finally(() => setPending(null));
  }, [blocked, pending, refresh, storyId, text, validationRetryToken]);

  const recover = useCallback(async (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : 'Thao tác thất bại.';
    if (reason instanceof ApiError && (reason.status === 409 || reason.status === 0)) {
      try {
        await refresh();
        setError(
          reason.status === 409
            ? 'Truyện vừa được admin khác cập nhật. Nội dung mới nhất đã được tải lại.'
            : `${message} Trạng thái mới nhất đã được tải lại.`,
        );
      } catch {
        setBlocked(true);
        setError('Chưa thể đối soát trạng thái. Hãy kiểm tra lại trước khi gửi thao tác mới.');
      }
      return;
    }
    setError(message);
  }, [refresh]);

  const applyMutation = useCallback(async (
    operation: PendingOperation,
    call: (revision: number) => Promise<MutationResponse>,
  ) => {
    if (!text || pending || blocked) return false;
    setPending(operation);
    setError(null);
    setNotice(null);
    try {
      const result = await call(text.text_revision);
      setText(result.story);
      setNotice(changeMessage(result));
      return true;
    } catch (reason) {
      await recover(reason);
      return false;
    } finally {
      setPending(null);
    }
  }, [blocked, pending, recover, text]);

  const runQuickAction = (action: QuickAction) =>
    applyMutation('edit', (revision) => quickEdit(storyId, action, revision));

  const runInstruction = (instruction: string) =>
    applyMutation('edit', (revision) => instructionEdit(storyId, instruction, revision));

  const addPage = (instruction: string | null) =>
    applyMutation('add', (revision) => addStoryPage(storyId, instruction, revision));

  const reorder = (pageIds: number[]) =>
    applyMutation('reorder', (revision) => reorderStoryPages(storyId, pageIds, revision));

  const removePage = (pageId: number) =>
    applyMutation('delete', (revision) => deleteStoryPage(storyId, pageId, revision));

  const retranslate = (target: 'title' | 'page', pageId?: number) =>
    applyMutation('retranslate', (revision) =>
      target === 'title'
        ? retranslateTitle(storyId, revision)
        : retranslatePage(storyId, pageId as number, revision),
    );

  const retryKhmerValidation = () => {
    if (!text || pending || blocked) return;
    validationAttempts.current.delete(text.text_revision);
    setValidationFailed(false);
    setError(null);
    setValidationRetryToken((value) => value + 1);
  };

  const confirm = async (acknowledge: boolean) => {
    if (!text || pending || blocked) return false;
    setPending('confirm');
    setError(null);
    try {
      const canonical = await confirmStoryText(storyId, text.text_revision, acknowledge);
      setText(canonical);
      setStory((current) => current
        ? { ...current, status: canonical.status, text_revision: canonical.text_revision }
        : current);
      setNotice('Nội dung đã được xác nhận và khóa. Chưa có ảnh nào được sinh.');
      return true;
    } catch (reason) {
      await recover(reason);
      return false;
    } finally {
      setPending(null);
    }
  };

  return {
    story,
    text,
    loading,
    error,
    notice,
    pending,
    blocked,
    validationFailed,
    refresh,
    retryKhmerValidation,
    runQuickAction,
    runInstruction,
    addPage,
    reorder,
    removePage,
    retranslate,
    confirm,
  };
}

function changeMessage(result: MutationResponse) {
  const changes = result.changes;
  if (!changes.has_changes) return 'AI không tạo thay đổi nội dung.';
  const parts: string[] = [];
  if (changes.title_changed) parts.push('đổi tiêu đề');
  if (changes.edited_page_ids.length) parts.push(`sửa ${changes.edited_page_ids.length} trang`);
  if (changes.added_page_ids.length) parts.push(`thêm ${changes.added_page_ids.length} trang`);
  if (changes.deleted_page_ids.length) parts.push(`xóa ${changes.deleted_page_ids.length} trang`);
  if (changes.order_changed) parts.push('đổi thứ tự trang');
  return `Đã lưu: ${parts.join(', ')}.`;
}