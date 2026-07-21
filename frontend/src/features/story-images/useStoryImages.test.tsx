import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story } from '@/features/stories/types';
import { ApiError } from '@/lib/api';
import { fetchStory } from '@/features/stories/api';
import { fetchStoryImages, startImageGeneration } from './api';
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
});