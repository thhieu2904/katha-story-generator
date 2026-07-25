'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStory } from '@/features/stories/api';
import {
  getWorkflowPresentation,
  getWorkflowRouteMode,
} from '@/features/story-workflow/workflow';
import { ApiError } from '@/lib/api';
import {
  createImagePlan,
  fetchStoryImages,
  saveImagePlanMapping,
  startImageGeneration,
} from './api';
import { IMAGE_POLL_INTERVAL_MS } from './constants';
import type {
  StoryImageMappingInput,
  StoryImagePendingOperation,
  StoryImagesState,
} from './types';

type MappingDraft = Record<number, number[]>;

function normalizeCharacterIds(ids: number[], allowedIds?: Set<number>): number[] {
  return [...new Set(ids)]
    .filter((id) => Number.isInteger(id) && id > 0 && (!allowedIds || allowedIds.has(id)))
    .sort((left, right) => left - right)
    .slice(0, 3);
}

function mappingsFromState(state: StoryImagesState): MappingDraft {
  return Object.fromEntries(
    state.pages.map((page) => [page.id, normalizeCharacterIds(page.character_ids)]),
  );
}

function mappingsMatch(state: StoryImagesState, draft: MappingDraft): boolean {
  return state.pages.every((page) => {
    const canonical = normalizeCharacterIds(page.character_ids);
    const local = normalizeCharacterIds(draft[page.id] || []);
    return canonical.length === local.length && canonical.every((id, index) => id === local[index]);
  });
}

function mappingPayload(state: StoryImagesState, draft: MappingDraft): StoryImageMappingInput[] {
  return state.pages.map((page) => ({
    page_id: page.id,
    character_ids: normalizeCharacterIds(draft[page.id] || []),
  }));
}

function messageFromReason(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError) {
    if (reason.status === 404) return 'Không tìm thấy truyện hoặc trang minh họa.';
    if (reason.status === 422) return 'Kế hoạch minh họa hoặc ảnh tham chiếu nhân vật chưa hợp lệ.';
    if (reason.status === 502) return 'Dịch vụ lập kế hoạch minh họa trả về dữ liệu không hợp lệ.';
    if (reason.status === 503) return 'Dịch vụ AI hoặc lưu trữ ảnh hiện chưa sẵn sàng.';
  }
  return reason instanceof Error ? reason.message : fallback;
}

function needsCanonicalReconcile(reason: unknown): boolean {
  return reason instanceof ApiError && (reason.status === 0 || reason.status === 409);
}

export type RefreshResult =
  | { ok: true; state: StoryImagesState }
  | { ok: false; error: string };

/**
 * mapping_locked semantics:
 * - mapping_locked = true: cấm sửa mapping (updatePageCharacters) và initial start.
 * - mapping_locked = true + can_retry/can_resume: cho phép recovery POST.
 * - generating_images chưa stale: chỉ poll progress, không POST.
 * - can_retry/can_resume = true: hiển thị recovery CTA, chỉ POST khi user xác nhận.
 * - mapping_locked && !can_retry && !can_resume: downstream terminal — không POST.
 */
export function useStoryImages(storyId: number) {
  const [imageState, setImageState] = useState<StoryImagesState | null>(null);
  const [draftMappings, setDraftMappings] = useState<MappingDraft>({});
  const [mappingDirty, setMappingDirty] = useState(false);
  const [mappingConflict, setMappingConflict] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<StoryImagePendingOperation>(null);
  const [blocked, setBlocked] = useState(false);
  const [redirectHref, setRedirectHref] = useState<string | null>(null);

  const draftMappingsRef = useRef<MappingDraft>({});
  const lastRevisionRef = useRef<number>(0);
  const requestSeqRef = useRef(0);

  const bumpSequence = useCallback(() => {
    requestSeqRef.current += 1;
  }, []);

  const beginCanonicalRead = useCallback(() => {
    requestSeqRef.current += 1;
    return requestSeqRef.current;
  }, []);

  const isCurrentRequest = useCallback((seq: number) => {
    return seq === requestSeqRef.current;
  }, []);

  const installCanonicalState = useCallback((next: StoryImagesState) => {
    const mappings = mappingsFromState(next);
    draftMappingsRef.current = mappings;
    lastRevisionRef.current = next.image_plan_revision;
    setImageState(next);
    setDraftMappings(mappings);
    setMappingDirty(false);
    setMappingConflict(false);
    setRedirectHref(null);
  }, []);

  const loadWorkspace = useCallback(async (reqSeq?: number): Promise<StoryImagesState | null> => {
    const story = await fetchStory(storyId);
    if (reqSeq !== undefined && !isCurrentRequest(reqSeq)) {
      return null;
    }

    const presentation = getWorkflowPresentation(story.route_key, story.status, story.image_workflow_kind);
    const routeMode = getWorkflowRouteMode(
      presentation,
      `/admin/stories/${story.route_key}/images`
    );

    if (routeMode === 'redirect') {
      if (reqSeq !== undefined && !isCurrentRequest(reqSeq)) {
        return null;
      }
      const workflowHref = presentation.canonicalHref;
      setRedirectHref(
        story.status === 'archived' ? `${workflowHref}?notice=archived` : workflowHref
      );
      return null;
    }

    try {
      const canonical = await fetchStoryImages(storyId);
      // Sequence guard: discard if a mutation or newer request
      // bumped requestSeqRef while this read was in-flight.
      if (reqSeq !== undefined && !isCurrentRequest(reqSeq)) {
        return null;
      }
      installCanonicalState(canonical);
      return canonical;
    } catch (reason) {
      if (reqSeq !== undefined && !isCurrentRequest(reqSeq)) {
        return null;
      }
      if (reason instanceof ApiError && reason.status === 409) {
        const latestStory = await fetchStory(storyId);
        if (reqSeq !== undefined && !isCurrentRequest(reqSeq)) {
          return null;
        }
        const latestPres = getWorkflowPresentation(latestStory.route_key, latestStory.status, latestStory.image_workflow_kind);
        const latestRouteMode = getWorkflowRouteMode(
          latestPres,
          `/admin/stories/${latestStory.route_key}/images`
        );
        if (latestRouteMode === 'redirect') {
          if (reqSeq !== undefined && !isCurrentRequest(reqSeq)) {
            return null;
          }
          const workflowHref = latestPres.canonicalHref;
          setRedirectHref(
            latestStory.status === 'archived' ? `${workflowHref}?notice=archived` : workflowHref
          );
          return null;
        }
      }
      throw reason;
    }
  }, [installCanonicalState, isCurrentRequest, storyId]);

  // Dirty-safe foreground install — only used when mapping is NOT dirty.
  const installCanonicalStateSafe = useCallback((next: StoryImagesState) => {
    bumpSequence();
    // If mapping is dirty or pending, don't overwrite local draft
    if (draftMappingsRef.current && Object.keys(draftMappingsRef.current).length > 0) {
      const prevRevision = lastRevisionRef.current;
      if (prevRevision > 0 && next.image_plan_revision !== prevRevision) {
        // Remote revision changed while we have a dirty local draft → conflict
        setMappingConflict(true);
      }
      // Update state but keep local draft mappings
      lastRevisionRef.current = next.image_plan_revision;
      setImageState(next);
      setRedirectHref(null);
    } else {
      installCanonicalState(next);
    }
  }, [bumpSequence, installCanonicalState]);

  // refresh returns typed result. Blocked only cleared after success.
  const refresh = useCallback(async (): Promise<RefreshResult> => {
    const seq = beginCanonicalRead();
    setLoading(true);
    setError(null);
    setPollError(null);
    try {
      const state = await loadWorkspace(seq);
      if (!isCurrentRequest(seq)) {
        return { ok: false, error: 'Thao tác đã bị hủy do có yêu cầu mới hơn.' };
      }
      if (state) {
        setBlocked(false);
        return { ok: true, state };
      }
      return { ok: false, error: 'Đang chuyển hướng…' };
    } catch (reason) {
      if (!isCurrentRequest(seq)) {
        return { ok: false, error: 'Thao tác đã bị hủy do có yêu cầu mới hơn.' };
      }
      const msg = messageFromReason(reason, 'Không thể tải không gian minh họa.');
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      if (isCurrentRequest(seq)) {
        setLoading(false);
      }
    }
  }, [beginCanonicalRead, isCurrentRequest, loadWorkspace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  // Foreground tab return — dirty-safe with request sequence guard
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const seq = beginCanonicalRead();
      if (mappingDirty || pending) {
        void fetchStoryImages(storyId)
          .then((canonical) => {
            if (!isCurrentRequest(seq)) return;
            installCanonicalStateSafe(canonical);
          })
          .catch(() => {});
      } else {
        void loadWorkspace(seq).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [beginCanonicalRead, installCanonicalStateSafe, isCurrentRequest, loadWorkspace, mappingDirty, pending, storyId]);

  const reconcileAfterUncertainMutation = useCallback(
    async (
      reason: unknown,
      fallback: string
    ): Promise<StoryImagesState | null> => {
      const seq = beginCanonicalRead();
      try {
        const canonical = await loadWorkspace(seq);
        if (!isCurrentRequest(seq)) return null;
        setBlocked(false);
        setError(
          reason instanceof ApiError && reason.status === 409
            ? 'Dữ liệu minh họa vừa được cập nhật. Trạng thái mới nhất đã được tải lại.'
            : `${messageFromReason(reason, fallback)} Trạng thái mới nhất đã được tải lại.`
        );
        return canonical;
      } catch {
        if (!isCurrentRequest(seq)) return null;
        setBlocked(true);
        setError(
          'Chưa thể đối soát trạng thái mới nhất. Hãy kiểm tra lại trước khi gửi thao tác khác.'
        );
        return null;
      }
    },
    [beginCanonicalRead, isCurrentRequest, loadWorkspace]
  );

  useEffect(() => {
    if (imageState?.status !== 'generating_images' || imageState.job_stale) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const scheduleNextPoll = () => {
      if (active) timer = setTimeout(poll, IMAGE_POLL_INTERVAL_MS);
    };

    const poll = async () => {
      const pollSeq = beginCanonicalRead();
      controller = new AbortController();
      try {
        const canonical = await fetchStoryImages(storyId, controller.signal);
        if (!active || !isCurrentRequest(pollSeq)) return;
        installCanonicalState(canonical);
        setPollError(null);
        if (canonical.status === 'generating_images' && !canonical.job_stale) {
          scheduleNextPoll();
        }
      } catch (reason) {
        if (!active || !isCurrentRequest(pollSeq)) return;
        if (reason instanceof Error && reason.name === 'AbortError') return;

        if (reason instanceof ApiError && reason.status === 409) {
          try {
            const canonical = await loadWorkspace(pollSeq);
            if (!active || !isCurrentRequest(pollSeq)) return;
            setPollError(null);
            if (canonical?.status === 'generating_images' && !canonical.job_stale) {
              scheduleNextPoll();
            }
          } catch (reconcileReason) {
            if (!active || !isCurrentRequest(pollSeq)) return;
            setPollError(
              messageFromReason(reconcileReason, 'Không thể kiểm tra tiến độ ảnh.')
            );
            scheduleNextPoll();
          }
          return;
        }

        setPollError(messageFromReason(reason, 'Không thể kiểm tra tiến độ ảnh.'));
        if (
          !(reason instanceof ApiError && [401, 403, 404].includes(reason.status))
        ) {
          scheduleNextPoll();
        }
      }
    };

    timer = setTimeout(poll, IMAGE_POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [beginCanonicalRead, imageState?.job_stale, imageState?.status, installCanonicalState, isCurrentRequest, loadWorkspace, storyId]);

  const updatePageCharacters = useCallback(
    (pageId: number, characterIds: number[]) => {
      if (!imageState || imageState.mapping_locked || pending || blocked || mappingConflict) return;
      const allowedIds = new Set(
        imageState.available_characters.map((character) => character.id)
      );
      const next = {
        ...draftMappingsRef.current,
        [pageId]: normalizeCharacterIds(characterIds, allowedIds),
      };
      draftMappingsRef.current = next;
      setDraftMappings(next);
      setMappingDirty(!mappingsMatch(imageState, next));
    },
    [blocked, imageState, mappingConflict, pending]
  );

  const discardAndReload = useCallback(async () => {
    bumpSequence();
    setMappingConflict(false);
    setMappingDirty(false);
    draftMappingsRef.current = {};
    await refresh();
  }, [bumpSequence, refresh]);

  const preparePlan = useCallback(async (): Promise<boolean> => {
    bumpSequence();
    if (
      !imageState ||
      pending ||
      blocked ||
      imageState.mapping_locked ||
      imageState.image_plan_ready ||
      imageState.status !== 'text_confirmed'
    ) {
      return false;
    }

    setPending('prepare');
    setError(null);
    setNotice(null);
    try {
      const canonical = await createImagePlan(
        storyId,
        imageState.text_revision,
        imageState.image_plan_revision
      );
      installCanonicalState(canonical);
      setNotice(
        'Đã tạo kế hoạch minh họa. Hãy kiểm tra lựa chọn nhân vật trước khi bắt đầu.'
      );
      return true;
    } catch (reason) {
      if (needsCanonicalReconcile(reason)) {
        await reconcileAfterUncertainMutation(reason, 'Không thể tạo kế hoạch minh họa.');
      } else {
        setError(messageFromReason(reason, 'Không thể tạo kế hoạch minh họa.'));
      }
      return false;
    } finally {
      setPending(null);
    }
  }, [blocked, bumpSequence, imageState, installCanonicalState, pending, reconcileAfterUncertainMutation, storyId]);

  const saveMapping = useCallback(async (): Promise<StoryImagesState | null> => {
    bumpSequence();
    if (
      !imageState ||
      pending ||
      blocked ||
      imageState.mapping_locked ||
      !imageState.image_plan_ready ||
      !mappingDirty
    ) {
      return imageState;
    }

    const pages = mappingPayload(imageState, draftMappingsRef.current);
    setPending('save_mapping');
    setError(null);
    setNotice(null);
    try {
      const canonical = await saveImagePlanMapping(
        storyId,
        imageState.image_plan_revision,
        pages
      );
      installCanonicalState(canonical);
      setNotice('Đã lưu lựa chọn nhân vật cho toàn bộ trang.');
      return canonical;
    } catch (reason) {
      if (needsCanonicalReconcile(reason)) {
        await reconcileAfterUncertainMutation(reason, 'Không thể lưu lựa chọn nhân vật.');
      } else {
        setError(messageFromReason(reason, 'Không thể lưu lựa chọn nhân vật.'));
      }
      return null;
    } finally {
      setPending(null);
    }
  }, [blocked, bumpSequence, imageState, installCanonicalState, mappingDirty, pending, reconcileAfterUncertainMutation, storyId]);

  const startGeneration = useCallback(
    async (overrideRevision?: number): Promise<boolean> => {
      bumpSequence();
      if (!imageState || pending || blocked || mappingDirty) {
        return false;
      }

      if (imageState.status === 'generating_images' && !imageState.job_stale) {
        return false;
      }

      const isInitialStart = !imageState.mapping_locked && imageState.can_start;
      const isRecoveryStart = imageState.can_retry || imageState.can_resume;

      if (!isInitialStart && !isRecoveryStart) {
        return false;
      }

      const revision = overrideRevision ?? imageState.image_plan_revision;
      setPending('start');
      setError(null);
      setNotice(null);
      try {
        const result = await startImageGeneration(storyId, revision);
        const readSeq = beginCanonicalRead();
        try {
          const canonical = await loadWorkspace(readSeq);
          if (canonical && isCurrentRequest(readSeq)) {
            installCanonicalState(canonical);
          }
        } catch (reason) {
          const canonical = await reconcileAfterUncertainMutation(
            reason,
            'Không thể đọc lại tiến độ sau khi bắt đầu sinh ảnh.'
          );
          return canonical?.status === 'generating_images';
        }
        setNotice(
          result.already_running
            ? 'Một quá trình tạo ảnh đang chạy. Đã tải lại tiến độ mới nhất.'
            : 'Đã bắt đầu sinh ảnh. Tiến độ sẽ tự cập nhật sau mỗi 3 giây.'
        );
        return true;
      } catch (reason) {
        if (needsCanonicalReconcile(reason)) {
          const canonical = await reconcileAfterUncertainMutation(
            reason,
            'Không thể xác nhận yêu cầu sinh ảnh.'
          );
          return canonical?.status === 'generating_images';
        }
        setError(messageFromReason(reason, 'Không thể bắt đầu sinh ảnh.'));
        return false;
      } finally {
        setPending(null);
      }
    },
    [beginCanonicalRead, blocked, bumpSequence, imageState, installCanonicalState, isCurrentRequest, loadWorkspace, mappingDirty, pending, reconcileAfterUncertainMutation, storyId]
  );

  /** Install a save response (from orchestration) into canonical state immediately.
   *  This ensures the UI reflects the saved mapping/revision even if a subsequent
   *  refresh fails, preventing stale CTA from reopening. */
  const installSaveResponse = useCallback(
    (state: StoryImagesState) => {
      bumpSequence();
      installCanonicalState(state);
    },
    [bumpSequence, installCanonicalState]
  );

  const activePage =
    imageState?.pages?.find((p) => p.image_status === 'generating') || null;

  const canPreparePlan = Boolean(
    imageState &&
      imageState.status === 'text_confirmed' &&
      !imageState.image_plan_ready &&
      !imageState.mapping_locked
  );
  const canEditMapping = Boolean(
    imageState &&
      imageState.status === 'text_confirmed' &&
      imageState.image_plan_ready &&
      !imageState.mapping_locked
  );

  return {
    imageState,
    draftMappings,
    mappingDirty,
    mappingConflict,
    loading,
    error,
    pollError,
    notice,
    pending,
    blocked,
    redirectHref,
    activePage,
    canPreparePlan,
    canEditMapping,
    refresh,
    discardAndReload,
    updatePageCharacters,
    preparePlan,
    saveMapping,
    startGeneration,
    installSaveResponse,
  };
}
