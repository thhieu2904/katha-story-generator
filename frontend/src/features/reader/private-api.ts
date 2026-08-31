import { ApiError, apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { KhmerKnowledge } from '@/features/vision/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const AUDIO_POLL_ATTEMPTS = 60;

export function preparePrivateStoryAudio(storyId: number) {
  return apiFetch<{ status: string; text_revision: number }>(
    `/api/stories/${storyId}/prepare-preview-audio`,
    { method: 'POST' },
  );
}

export function fetchPrivateStoryLearningContext(storyId: number, signal?: AbortSignal) {
  return apiFetch<{ class_name: string; knowledge: KhmerKnowledge }>(
    `/api/stories/${storyId}/learning-context`,
    { signal },
  );
}

function waitForRetry(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export async function fetchPrivateStoryPageAudio(
  storyId: number,
  pageNo: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const headers = new Headers({ Accept: 'audio/wav' });
  if (data.session?.access_token) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }

  for (let attempt = 0; attempt < AUDIO_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(
      `${API_BASE_URL}/api/stories/${storyId}/pages/${pageNo}/preview-audio`,
      { headers, signal },
    );
    if (response.ok) {
      const audio = await response.blob();
      if (audio.size === 0) throw new ApiError('Tệp giọng đọc trống.', 0);
      return audio;
    }
    if (response.status !== 503) {
      throw new ApiError('Không thể tải giọng đọc riêng tư.', response.status);
    }
    const retrySeconds = Number(response.headers.get('Retry-After') || '5');
    await waitForRetry(Math.max(retrySeconds, 1) * 1000, signal);
  }

  throw new ApiError('Giọng đọc vẫn đang được chuẩn bị. Hãy thử lại sau.', 503);
}
