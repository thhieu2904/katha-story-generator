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
import { formatCopy, type UiCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';

export function useStoryEditor(storyId: number) {
  const { copy, language } = useUiCopy();
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
          if (active) {
            setError(
              language === 'vi' && reason instanceof Error
                ? reason.message
                : copy.storyLoadShortFailed,
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [copy.storyLoadShortFailed, language, refresh]);

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
        setError(
          language === 'vi' && reason instanceof Error
            ? reason.message
            : copy.stateCheckShortFailed,
        );
        timer = setTimeout(poll, 3000);
      }
    };

    timer = setTimeout(poll, 3000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [copy.stateCheckShortFailed, language, story?.status, refresh]);

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
        setNotice(copy.khmerValidationDone);
      })
      .catch(async (reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 409) {
          await refresh().catch(() => setBlocked(true));
          return;
        }
        if (reason instanceof ApiError && reason.status === 0) {
          try {
            await refresh();
            setError(
              formatCopy(copy.latestStateReloaded, {
                message: language === 'vi' ? reason.message : copy.actionFailed,
              }),
            );
          } catch {
            setBlocked(true);
            setError(copy.khmerReconcileFailed);
          }
        } else {
          setError(
            language === 'vi' && reason instanceof Error
              ? reason.message
              : copy.khmerValidationFailed,
          );
        }
        setValidationFailed(true);
      })
      .finally(() => setPending(null));
  }, [
    blocked,
    copy.actionFailed,
    copy.khmerReconcileFailed,
    copy.khmerValidationDone,
    copy.khmerValidationFailed,
    copy.latestStateReloaded,
    language,
    pending,
    refresh,
    storyId,
    text,
    validationRetryToken,
  ]);

  const recover = useCallback(async (reason: unknown) => {
    const message =
      language === 'vi' && reason instanceof Error ? reason.message : copy.actionFailed;
    if (reason instanceof ApiError && (reason.status === 409 || reason.status === 0)) {
      try {
        await refresh();
        setError(
          reason.status === 409
            ? copy.concurrentUpdateReloaded
            : formatCopy(copy.latestStateReloaded, { message }),
        );
      } catch {
        setBlocked(true);
        setError(copy.stateReconcileFailed);
      }
      return;
    }
    setError(message);
  }, [
    copy.actionFailed,
    copy.concurrentUpdateReloaded,
    copy.latestStateReloaded,
    copy.stateReconcileFailed,
    language,
    refresh,
  ]);

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
      setNotice(changeMessage(result, copy));
      return true;
    } catch (reason) {
      await recover(reason);
      return false;
    } finally {
      setPending(null);
    }
  }, [blocked, copy, pending, recover, text]);

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
      setNotice(copy.contentConfirmedNoImages);
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

function changeMessage(result: MutationResponse, copy: UiCopy) {
  const changes = result.changes;
  if (!changes.has_changes) return copy.aiNoChanges;
  const parts: string[] = [];
  if (changes.title_changed) parts.push(copy.changedTitle);
  if (changes.edited_page_ids.length) {
    parts.push(formatCopy(copy.editedPages, { count: changes.edited_page_ids.length }));
  }
  if (changes.added_page_ids.length) {
    parts.push(formatCopy(copy.addedPages, { count: changes.added_page_ids.length }));
  }
  if (changes.deleted_page_ids.length) {
    parts.push(formatCopy(copy.deletedPages, { count: changes.deleted_page_ids.length }));
  }
  if (changes.order_changed) parts.push(copy.changedPageOrder);
  return formatCopy(copy.changesSaved, { changes: parts.join(', ') });
}
