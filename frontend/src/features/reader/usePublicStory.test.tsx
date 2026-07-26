import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSharedStory } from './api';
import type { PublicStory } from './types';
import { PublicApiError } from '@/lib/public-api';
import { usePublicStory } from './usePublicStory';

vi.mock('./api', () => ({ fetchSharedStory: vi.fn() }));

const mockedFetchSharedStory = vi.mocked(fetchSharedStory);

function story(title: string): PublicStory {
  return {
    title_vi: title,
    title_km: 'រឿងសាកល្បង',
    target_age: 'preschool',
    page_count: 1,
    cover: { background_url: null },
    pages: [{ page_no: 1, text_km: 'ទំព័រ។', text_vi: 'Trang.', image_url: null }],
  };
}

describe('usePublicStory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
  });

  it('lets the initial request clear loading after a newer silent refresh', async () => {
    let resolveInitial!: (value: PublicStory) => void;
    const initial = new Promise<PublicStory>((resolve) => {
      resolveInitial = resolve;
    });
    mockedFetchSharedStory
      .mockReturnValueOnce(initial)
      .mockResolvedValueOnce(story('Bản mới'));

    const { result } = renderHook(() => usePublicStory('token'));
    await act(async () => Promise.resolve());
    expect(result.current.loading).toBe(true);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(result.current.story?.title_vi).toBe('Bản mới');
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveInitial(story('Bản cũ'));
      await initial;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.story?.title_vi).toBe('Bản mới');
  });

  it('does not let an aborted old token clear the new token loading owner', async () => {
    let resolveNew!: (value: PublicStory) => void;
    mockedFetchSharedStory
      .mockImplementationOnce((_token, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
      )
      .mockImplementationOnce(
        () => new Promise<PublicStory>((resolve) => { resolveNew = resolve; }),
      );

    const { result, rerender } = renderHook(
      ({ token }) => usePublicStory(token),
      { initialProps: { token: 'old-token' } },
    );
    await act(async () => Promise.resolve());
    rerender({ token: 'new-token' });
    await act(async () => Promise.resolve());
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveNew(story('Token mới'));
      await Promise.resolve();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.story?.title_vi).toBe('Token mới');
  });

  it('keeps the initial canonical story when it finishes before a failing silent refresh', async () => {
    let resolveInitial!: (value: PublicStory) => void;
    let rejectSilent!: (reason: Error) => void;
    const initial = new Promise<PublicStory>((resolve) => {
      resolveInitial = resolve;
    });
    const silent = new Promise<PublicStory>((_resolve, reject) => {
      rejectSilent = reject;
    });
    mockedFetchSharedStory.mockReturnValueOnce(initial).mockReturnValueOnce(silent);

    const { result } = renderHook(() => usePublicStory('token'));
    await act(async () => Promise.resolve());
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await act(async () => {
      resolveInitial(story('Bản canonical ban đầu'));
      await initial;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.story?.title_vi).toBe('Bản canonical ban đầu');
    expect(result.current.error).toBeNull();

    await act(async () => {
      rejectSilent(new Error('silent refresh failed'));
      await Promise.resolve();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.story?.title_vi).toBe('Bản canonical ban đầu');
    expect(result.current.error).toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it('does not resurrect an old initial response after a newer silent 404', async () => {
    let resolveInitial!: (value: PublicStory) => void;
    let rejectSilent!: (reason: Error) => void;
    const initial = new Promise<PublicStory>((resolve) => {
      resolveInitial = resolve;
    });
    const silent = new Promise<PublicStory>((_resolve, reject) => {
      rejectSilent = reject;
    });
    mockedFetchSharedStory.mockReturnValueOnce(initial).mockReturnValueOnce(silent);

    const { result } = renderHook(() => usePublicStory('token'));
    await act(async () => Promise.resolve());
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await act(async () => {
      rejectSilent(new PublicApiError('Story not found', 404));
      await Promise.resolve();
    });
    expect(result.current.notFound).toBe(true);
    expect(result.current.story).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveInitial(story('Bản cũ không được hồi sinh'));
      await initial;
    });
    expect(result.current.notFound).toBe(true);
    expect(result.current.story).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
