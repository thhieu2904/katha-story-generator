import { apiFetch } from '@/lib/api';
import type { StoryText } from '@/features/stories/types';
import type { MutationResponse, QuickAction } from './types';

const AI_TIMEOUT_MS = 285_000;

export function quickEdit(storyId: number, action: QuickAction, expectedRevision: number) {
  return apiFetch<MutationResponse>(`/api/stories/${storyId}/text/edits`, {
    method: 'POST',
    timeoutMs: AI_TIMEOUT_MS,
    body: JSON.stringify({ kind: 'quick_action', action, expected_revision: expectedRevision }),
  });
}

export function instructionEdit(storyId: number, instruction: string, expectedRevision: number) {
  return apiFetch<MutationResponse>(`/api/stories/${storyId}/text/edits`, {
    method: 'POST',
    timeoutMs: AI_TIMEOUT_MS,
    body: JSON.stringify({
      kind: 'instruction',
      instruction_vi: instruction,
      expected_revision: expectedRevision,
    }),
  });
}

export function addStoryPage(storyId: number, instruction: string | null, expectedRevision: number) {
  return apiFetch<MutationResponse>(`/api/stories/${storyId}/pages`, {
    method: 'POST',
    timeoutMs: AI_TIMEOUT_MS,
    body: JSON.stringify({
      after_page_id: null,
      instruction_vi: instruction || null,
      expected_revision: expectedRevision,
    }),
  });
}

export function reorderStoryPages(storyId: number, pageIds: number[], expectedRevision: number) {
  return apiFetch<MutationResponse>(`/api/stories/${storyId}/pages/order`, {
    method: 'PUT',
    body: JSON.stringify({ page_ids: pageIds, expected_revision: expectedRevision }),
  });
}

export function deleteStoryPage(storyId: number, pageId: number, expectedRevision: number) {
  return apiFetch<MutationResponse>(
    `/api/stories/${storyId}/pages/${pageId}?expected_revision=${expectedRevision}`,
    { method: 'DELETE' },
  );
}

export function validateKhmer(storyId: number, expectedRevision: number) {
  return apiFetch<StoryText>(`/api/stories/${storyId}/validate-km`, {
    method: 'POST',
    body: JSON.stringify({ expected_revision: expectedRevision }),
  });
}

export function retranslateTitle(storyId: number, expectedRevision: number) {
  return apiFetch<MutationResponse>(`/api/stories/${storyId}/retranslate-km`, {
    method: 'POST',
    timeoutMs: AI_TIMEOUT_MS,
    body: JSON.stringify({ target: 'title', expected_revision: expectedRevision }),
  });
}

export function retranslatePage(storyId: number, pageId: number, expectedRevision: number) {
  return apiFetch<MutationResponse>(`/api/stories/${storyId}/retranslate-km`, {
    method: 'POST',
    timeoutMs: AI_TIMEOUT_MS,
    body: JSON.stringify({ target: 'page', page_id: pageId, expected_revision: expectedRevision }),
  });
}

export function confirmStoryText(storyId: number, expectedRevision: number, acknowledge: boolean) {
  return apiFetch<StoryText>(`/api/stories/${storyId}/confirm-text`, {
    method: 'POST',
    body: JSON.stringify({
      expected_revision: expectedRevision,
      acknowledge_khmer_warnings: acknowledge,
    }),
  });
}