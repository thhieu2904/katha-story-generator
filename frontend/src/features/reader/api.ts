import { publicFetch } from '@/lib/public-api';
import type { PublicStory } from './types';

export function fetchSharedStory(shareToken: string, signal?: AbortSignal) {
  return publicFetch<PublicStory>(`/api/public/shared-stories/${shareToken}`, signal);
}
