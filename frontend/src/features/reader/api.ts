import { PublicApiError, publicFetch } from '@/lib/public-api';
import type { PublicStory } from './types';

export function fetchSharedStory(shareToken: string, signal?: AbortSignal) {
  return publicFetch<PublicStory>(`/api/public/shared-stories/${shareToken}`, signal);
}

export function getSharedStoryPageAudioUrl(shareToken: string, pageNo: number) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${apiBaseUrl}/api/public/shared-stories/${encodeURIComponent(shareToken)}/pages/${pageNo}/audio`;
}

export async function fetchSharedStoryPageAudio(
  shareToken: string,
  pageNo: number,
  signal?: AbortSignal,
) {
  const response = await fetch(getSharedStoryPageAudioUrl(shareToken, pageNo), {
    signal,
    headers: { Accept: 'audio/wav' },
  });
  if (!response.ok) {
    throw new PublicApiError('Failed to generate Khmer narration', response.status);
  }
  return response.blob();
}
