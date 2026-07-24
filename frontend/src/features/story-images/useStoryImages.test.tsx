import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story, StoryRouteKey } from '@/features/stories/types';
import { ApiError } from '@/lib/api';
import { fetchStory } from '@/features/stories/api';
import { createImagePlan, fetchStoryImages, saveImagePlanMapping, startImageGeneration } from './api';
import { IMAGE_POLL_INTERVAL_MS } from './constants';
import type { StoryImagesState } from './types';
import { useStoryImages } from './useStoryImages';

vi.mock('@/features/stories/api', () => ({
  fetchStory: vi.fn(),
}));

vi.mock('./api', () => ({
  createImagePlan: vi.fn(),
  fetchStoryImages: vi.fn(),
  saveImagePlanMapping: vi.fn(),
  startImageGeneration: vi.fn(),
}));

const mockedFetchStory = vi.mocked(fetchStory);
const mockedFetchStoryImages = vi.mocked(fetchStoryImages);
const mockedStartImageGeneration = vi.mocked(startImageGeneration);

function story(status: string): Story {
  return {
    id: 10,
    route_key: 's1_UkLWZg9D' as StoryRouteKey,
    title_vi: 'Truyện kiểm thử',
    title_km: null,
    description_vi: 'Một truyện dùng để kiểm thử workspace minh họa.',
    backbone_id: null,
    genre_id: null,
    art_style_id: null,
    target_age: 'preschool',
    length_pref: 'short',
    status,
    text_revision: 1,
    cover_image_url: null,
    created_by: null,
    character_ids: [],
    created_at: null,
    updated_at: null,
  };
}

function imageState(overrides: Partial<StoryImagesState> = {}): StoryImagesState {
  return {
    story_id: 10,
    title_vi: 'Truyện kiểm thử',
    status: 'text_confirmed',
    text_revision: 1,
    image_plan_revision: 2,
    image_plan_ready: true,
    mapping_locked: false,
    job_id: null,
    job_stale: false,
    can_start: false,
    can_retry: false,
    can_resume: false,
    progress: {
      total: 1,
      pending: 0,
      generating: 0,
      completed: 1,
      failed: 0,
    },
    available_characters: [],
    pages: [
      {
        id: 101,
        page_no: 1,
        text_vi: 'Một trang kiểm thử.',
        text_km: 'ទំព័រសាកល្បង។',
        text_en: 'A test page.',
        image_scene_en: 'A bright, safe scene.',
        image_prompt_en: 'A bright, safe scene in storybook style.',
        character_ids: [],
        image_status: 'completed',
        image_url: 'https://assets.example.test/page.webp',
        image_attempt_count: 1,
        image_error_code: null,
        updated_at: null,
      },
    ],
    ...overrides,
  };
}

async function flushInitialLoad(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('useStoryImages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls, reconciles a 409, and installs the canonical image state', async () => {
    const generating = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-1',
      progress: { total: 1, pending: 0, generating: 1, completed: 0, failed: 0 },
      pages: [{ ...imageState().pages[0], image_status: 'generating', image_url: null }],
    });
    const finished = imageState({ status: 'pending_review', mapping_locked: true });
    mockedFetchStory
      .mockResolvedValueOnce(story('generating_images'))
      .mockResolvedValueOnce(story('pending_review'));
    mockedFetchStoryImages
      .mockResolvedValueOnce(generating)
      .mockRejectedValueOnce(new ApiError('stale read', 409))
      .mockResolvedValueOnce(finished);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    expect(result.current.imageState).toEqual(generating);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IMAGE_POLL_INTERVAL_MS);
    });

    expect(mockedFetchStoryImages).toHaveBeenCalledTimes(3);
    expect(mockedFetchStory).toHaveBeenCalledTimes(2);
    expect(result.current.imageState).toEqual(finished);
    expect(result.current.pollError).toBeNull();
  });

  it('starts a retry from canonical retry state and refreshes progress', async () => {
    const retryable = imageState({
      mapping_locked: true,
      can_retry: true,
      progress: { total: 2, pending: 0, generating: 0, completed: 1, failed: 1 },
      pages: [
        imageState().pages[0],
        {
          ...imageState().pages[0],
          id: 102,
          page_no: 2,
          image_status: 'failed',
          image_url: null,
          image_error_code: 'R2_UPLOAD_FAILED',
        },
      ],
    });
    const running = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-retry',
      progress: { total: 2, pending: 0, generating: 1, completed: 1, failed: 0 },
    });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValueOnce(retryable).mockResolvedValueOnce(running);
    mockedStartImageGeneration.mockResolvedValue({
      job_id: 'claim-retry',
      already_running: false,
      status: 'generating_images',
      progress: running.progress,
    });

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    let started = false;
    await act(async () => {
      started = await result.current.startGeneration();
    });

    expect(started).toBe(true);
    expect(mockedStartImageGeneration).toHaveBeenCalledWith(10, 2);
    expect(result.current.imageState).toEqual(running);
  });

  it('resumes a stale job and accepts an all-complete finalization response', async () => {
    const stale = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-stale',
      job_stale: true,
      can_resume: true,
      progress: { total: 1, pending: 0, generating: 0, completed: 1, failed: 0 },
    });
    const finalized = imageState({ status: 'pending_review', mapping_locked: true });
    mockedFetchStory.mockResolvedValue(story('generating_images'));
    mockedFetchStoryImages.mockResolvedValueOnce(stale).mockResolvedValueOnce(finalized);
    mockedStartImageGeneration.mockResolvedValue({
      job_id: 'claim-finalize',
      already_running: false,
      status: 'generating_images',
      progress: stale.progress,
    });

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    let started = false;
    await act(async () => {
      started = await result.current.startGeneration();
    });

    expect(started).toBe(true);
    expect(mockedStartImageGeneration).toHaveBeenCalledWith(10, 2);
    expect(result.current.imageState).toEqual(finalized);
  });
  it('poll timeout retains last-known state', async () => {
    const generating = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-1',
    });
    mockedFetchStory.mockResolvedValue(story('generating_images'));
    mockedFetchStoryImages
      .mockResolvedValueOnce(generating)
      .mockRejectedValueOnce(new ApiError('timeout', 0));

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    expect(result.current.imageState).toEqual(generating);
    expect(result.current.pollError).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IMAGE_POLL_INTERVAL_MS);
    });

    expect(result.current.imageState).toEqual(generating);
    expect(result.current.pollError).toBe('timeout');
    expect(mockedFetchStoryImages).toHaveBeenCalledTimes(2);
  });

  it('poll 3s but request hangs — only one request in-flight', async () => {
    const generating = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-1',
    });
    mockedFetchStory.mockResolvedValue(story('generating_images'));
    mockedFetchStoryImages
      .mockResolvedValueOnce(generating)
      .mockImplementationOnce(() => new Promise(() => {}));

    renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    expect(mockedFetchStoryImages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IMAGE_POLL_INTERVAL_MS * 2);
    });

    expect(mockedFetchStoryImages).toHaveBeenCalledTimes(2);
  });

  it('unmount aborts request', async () => {
    const generating = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-1',
    });
    mockedFetchStory.mockResolvedValue(story('generating_images'));

    // First call resolves to start the component
    mockedFetchStoryImages.mockResolvedValueOnce(generating);

    // Second call (poll) hangs so we can capture the signal
    let capturedSignal: AbortSignal | undefined;
    mockedFetchStoryImages.mockImplementationOnce((_storyId, signal) => {
      capturedSignal = signal;
      return new Promise(() => {}); // hang
    });

    const { unmount } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    // Advance to trigger the first poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IMAGE_POLL_INTERVAL_MS);
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('stale/late response does not overwrite newer canonical state (epoch guard)', async () => {
    const generatingRev1 = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-1',
      image_plan_revision: 1,
    });
    const generatingRev5 = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_id: 'claim-1',
      image_plan_revision: 5,
    });

    mockedFetchStory.mockResolvedValue(story('generating_images'));
    mockedFetchStoryImages.mockResolvedValueOnce(generatingRev1);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    let resolvePoll!: (state: StoryImagesState) => void;
    mockedFetchStoryImages.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolvePoll = resolve;
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IMAGE_POLL_INTERVAL_MS);
    });

    mockedFetchStoryImages.mockResolvedValueOnce(generatingRev5);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.imageState?.image_plan_revision).toBe(5);

    await act(async () => {
      resolvePoll(generatingRev1);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.imageState?.image_plan_revision).toBe(5);
  });

  it('mount does NOT auto-run createImagePlan', async () => {
    const mockedCreateImagePlan = vi.mocked(createImagePlan);
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValue(imageState({
      status: 'text_confirmed',
      image_plan_ready: false,
    }));

    renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    expect(mockedFetchStory).toHaveBeenCalled();
    expect(mockedFetchStoryImages).toHaveBeenCalled();
    expect(mockedCreateImagePlan).not.toHaveBeenCalled();
  });

  it('startGeneration rejects when mapping_locked is true and not in recovery mode', async () => {
    const lockedState = imageState({
      mapping_locked: true,
      can_start: true,
      can_retry: false,
      can_resume: false,
    });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValue(lockedState);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    let started = false;
    await act(async () => {
      started = await result.current.startGeneration();
    });

    expect(started).toBe(false);
    expect(mockedStartImageGeneration).not.toHaveBeenCalled();
  });

  it('startGeneration rejects when status is generating_images and job is active (!job_stale)', async () => {
    const activeGeneratingState = imageState({
      status: 'generating_images',
      mapping_locked: true,
      job_stale: false,
      can_retry: true,
    });
    mockedFetchStory.mockResolvedValue(story('generating_images'));
    mockedFetchStoryImages.mockResolvedValue(activeGeneratingState);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    let started = false;
    await act(async () => {
      started = await result.current.startGeneration();
    });

    expect(started).toBe(false);
    expect(mockedStartImageGeneration).not.toHaveBeenCalled();
  });

  it('installCanonicalStateSafe increments epochRef so a late poll cannot overwrite dirty mapping safe state', async () => {
    const chars = [{ id: 10, name: 'Char 10', avatar_url: null, thumbnail_url: null, updated_at: null }];
    const rev1 = imageState({ status: 'text_confirmed', image_plan_revision: 1, available_characters: chars });
    const rev2 = imageState({ status: 'text_confirmed', image_plan_revision: 2, available_characters: chars });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValueOnce(rev1);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    // Set dirty draft mapping
    act(() => {
      result.current.updatePageCharacters(101, [10]);
    });
    expect(result.current.mappingDirty).toBe(true);

    let resolvePoll!: (state: StoryImagesState) => void;
    const pollPromise = new Promise<StoryImagesState>((res) => { resolvePoll = res; });
    mockedFetchStoryImages.mockReturnValueOnce(pollPromise);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IMAGE_POLL_INTERVAL_MS);
    });

    // Save mapping installs rev2
    vi.mocked(saveImagePlanMapping).mockResolvedValueOnce(rev2);
    await act(async () => {
      await result.current.saveMapping();
    });
    expect(result.current.imageState?.image_plan_revision).toBe(2);

    // Now late poll resolves with rev1
    await act(async () => {
      resolvePoll(rev1);
      await vi.advanceTimersByTimeAsync(0);
    });

    // Must still be rev2 (not overwritten by rev1)
    expect(result.current.imageState?.image_plan_revision).toBe(2);
  });

  it('foreground dirty: two out-of-order visibility responses — only the latest is installed', async () => {
    const chars = [{ id: 10, name: 'Char 10', avatar_url: null, thumbnail_url: null, updated_at: null }];
    const rev1 = imageState({ status: 'text_confirmed', image_plan_revision: 1, available_characters: chars });
    const rev3 = imageState({ status: 'text_confirmed', image_plan_revision: 3, available_characters: chars });
    const rev5 = imageState({ status: 'text_confirmed', image_plan_revision: 5, available_characters: chars });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValueOnce(rev1);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    // Set dirty draft mapping so visibility uses installCanonicalStateSafe path
    act(() => {
      result.current.updatePageCharacters(101, [10]);
    });
    expect(result.current.mappingDirty).toBe(true);

    // Set up two fetch calls: F1 resolves slowly, F2 resolves quickly
    let resolveF1!: (state: StoryImagesState) => void;
    const f1Promise = new Promise<StoryImagesState>((res) => { resolveF1 = res; });
    mockedFetchStoryImages
      .mockReturnValueOnce(f1Promise)         // F1 (first visibility event)
      .mockResolvedValueOnce(rev5);           // F2 (second visibility event)

    // Fire first visibility event → triggers F1
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fire second visibility event → triggers F2 (resolves immediately with rev5)
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    // F2 with rev5 should be installed (latest sequence)
    // Now resolve F1 late with rev3
    await act(async () => {
      resolveF1(rev3);
      await vi.advanceTimersByTimeAsync(0);
    });

    // rev3 from F1 should be discarded because F2 incremented the request sequence
    // The state MUST strictly retain rev5 (from F2)
    expect(result.current.imageState?.image_plan_revision).toBe(5);
  });

  it('installSaveResponse updates canonical state immediately', async () => {
    const rev1 = imageState({ image_plan_revision: 1 });
    const rev5 = imageState({ image_plan_revision: 5 });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValueOnce(rev1);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    expect(result.current.imageState?.image_plan_revision).toBe(1);

    act(() => {
      result.current.installSaveResponse(rev5);
    });

    expect(result.current.imageState?.image_plan_revision).toBe(5);
    expect(result.current.mappingDirty).toBe(false);
  });

  it('preparePlan synchronously bumps sequence counter at start, invalidating in-flight GET', async () => {
    const rev1 = imageState({ status: 'text_confirmed', image_plan_ready: false });
    const rev3 = imageState({ status: 'text_confirmed', image_plan_ready: true, image_plan_revision: 3 });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValueOnce(rev1);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    let resolveGET!: (state: StoryImagesState) => void;
    const inFlightPromise = new Promise<StoryImagesState>((res) => { resolveGET = res; });
    mockedFetchStoryImages.mockReturnValueOnce(inFlightPromise);

    // Trigger background read
    void result.current.refresh();

    // Start preparePlan mutation -> bumps sequence synchronously at start
    vi.mocked(createImagePlan).mockResolvedValueOnce(rev3);
    let prepared = false;
    await act(async () => {
      prepared = await result.current.preparePlan();
    });

    expect(prepared).toBe(true);
    expect(result.current.imageState?.image_plan_revision).toBe(3);

    // Resolve late background GET with rev1
    await act(async () => {
      resolveGET(rev1);
      await vi.advanceTimersByTimeAsync(0);
    });

    // The late GET response must be dropped, state retains rev3
    expect(result.current.imageState?.image_plan_revision).toBe(3);
  });

  it('reconcileAfterUncertainMutation discards state update if sequence bumped during reconcile load', async () => {
    const rev1 = imageState({ image_plan_revision: 1 });
    const rev3 = imageState({ image_plan_revision: 3 });
    mockedFetchStory.mockResolvedValue(story('text_confirmed'));
    mockedFetchStoryImages.mockResolvedValueOnce(rev1);

    const { result } = renderHook(() => useStoryImages(10));
    await flushInitialLoad();

    // Cause preparePlan to fail with status 409
    vi.mocked(createImagePlan).mockRejectedValueOnce(new ApiError('Conflict', 409));

    let resolveReconcile!: (state: StoryImagesState) => void;
    const reconcilePromise = new Promise<StoryImagesState>((res) => { resolveReconcile = res; });
    mockedFetchStoryImages.mockReturnValueOnce(reconcilePromise);

    // Trigger preparePlan -> enters reconcileAfterUncertainMutation
    let preparePromise!: Promise<boolean>;
    act(() => {
      preparePromise = result.current.preparePlan();
    });

    // Flush microtasks so fetchStory resolves and loadWorkspace reaches fetchStoryImages
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // While reconcile is pending, install newer save response (bumps sequence)
    act(() => {
      result.current.installSaveResponse(imageState({ image_plan_revision: 99 }));
    });
    expect(result.current.imageState?.image_plan_revision).toBe(99);

    // Resolve reconcile load with rev3
    await act(async () => {
      resolveReconcile(rev3);
      await vi.advanceTimersByTimeAsync(0);
    });

    await preparePromise;

    // Stale reconcile response rev3 must be dropped, state stays 99
    expect(result.current.imageState?.image_plan_revision).toBe(99);
  });
});