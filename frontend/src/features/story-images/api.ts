import { apiFetch } from '@/lib/api';
import {
  IMAGE_PLAN_TIMEOUT_MS,
  IMAGE_START_TIMEOUT_MS,
} from './constants';
import type {
  StartImageGenerationResponse,
  StoryImageMappingInput,
  StoryImagesState,
} from './types';

export function fetchStoryImages(storyId: number, signal?: AbortSignal) {
  return apiFetch<StoryImagesState>(`/api/stories/${storyId}/images`, { signal });
}

export function createImagePlan(
  storyId: number,
  expectedTextRevision: number,
  expectedImagePlanRevision: number,
) {
  return apiFetch<StoryImagesState>(`/api/stories/${storyId}/image-plan`, {
    method: 'POST',
    timeoutMs: IMAGE_PLAN_TIMEOUT_MS,
    body: JSON.stringify({
      expected_text_revision: expectedTextRevision,
      expected_image_plan_revision: expectedImagePlanRevision,
    }),
  });
}

export function saveImagePlanMapping(
  storyId: number,
  expectedImagePlanRevision: number,
  pages: StoryImageMappingInput[],
) {
  return apiFetch<StoryImagesState>(`/api/stories/${storyId}/image-plan`, {
    method: 'PUT',
    body: JSON.stringify({
      expected_image_plan_revision: expectedImagePlanRevision,
      pages,
    }),
  });
}

export function startImageGeneration(
  storyId: number,
  expectedImagePlanRevision: number,
) {
  return apiFetch<StartImageGenerationResponse>(`/api/stories/${storyId}/generate-images`, {
    method: 'POST',
    timeoutMs: IMAGE_START_TIMEOUT_MS,
    body: JSON.stringify({ expected_image_plan_revision: expectedImagePlanRevision }),
  });
}
