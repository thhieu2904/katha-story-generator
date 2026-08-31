import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { fetchDictionary, fetchDictionaryAudio } from './api';

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('fetchDictionary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'admin-token' } },
      error: null,
    } as never);
    vi.mocked(apiFetch).mockResolvedValue({
      source: 'Kiêm Hạnh',
      query: 'cổ chai',
      items: [],
      total: 0,
      page: 2,
      page_size: 24,
      total_pages: 0,
    });
  });

  it('encodes the query and pagination parameters', async () => {
    const controller = new AbortController();

    await fetchDictionary({
      query: 'cổ chai',
      page: 2,
      pageSize: 24,
      signal: controller.signal,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/dictionary?q=c%E1%BB%95+chai&page=2&page_size=24',
      { signal: controller.signal },
    );
  });

  it('loads canonical pronunciation audio with the current admin session', async () => {
    const audio = new Blob(['RIFFxxxxWAVEaudio'], { type: 'audio/wav' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(audio, { status: 200, headers: { 'Content-Type': 'audio/wav' } }),
    );

    const result = await fetchDictionaryAudio(3);
    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toBe('audio/wav');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/dictionary/3/audio',
      expect.objectContaining({
        headers: expect.objectContaining({}),
      }),
    );
    const request = fetchMock.mock.calls[0][1];
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer admin-token');
    expect(new Headers(request?.headers).get('Accept')).toBe('audio/wav');
  });
});
