import { ApiError, apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { DictionarySearchResponse } from './types';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const DICTIONARY_AUDIO_TIMEOUT_MS = 180_000;

interface DictionarySearchParams {
  query: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export function fetchDictionary({
  query,
  page,
  pageSize,
  signal,
}: DictionarySearchParams): Promise<DictionarySearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  });
  return apiFetch<DictionarySearchResponse>(`/api/dictionary?${params.toString()}`, { signal });
}

export async function fetchDictionaryAudio(entryId: number, signal?: AbortSignal): Promise<Blob> {
  const timeoutSignal = AbortSignal.timeout(DICTIONARY_AUDIO_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const headers = new Headers({ Accept: 'audio/wav' });
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const accessToken = data.session?.access_token;
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/dictionary/${entryId}/audio`, {
      headers,
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('Không thể chuẩn bị phát âm từ điển.', 0);
  }

  if (!response.ok) {
    let detail = 'Không thể chuẩn bị phát âm từ điển.';
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // Keep the safe fallback for a non-JSON proxy response.
    }
    throw new ApiError(detail, response.status);
  }

  const audio = await response.blob();
  if (audio.size === 0) throw new ApiError('Máy chủ trả về tệp phát âm trống.', 0);
  return audio;
}
