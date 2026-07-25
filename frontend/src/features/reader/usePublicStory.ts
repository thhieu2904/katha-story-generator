import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSharedStory } from './api';
import type { PublicStory } from './types';
import { PublicApiError } from '@/lib/public-api';

export function usePublicStory(shareToken: string) {
  const [story, setStory] = useState<PublicStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchCountRef = useRef(0);

  const load = useCallback(async (token: string, signal?: AbortSignal, isSilent = false) => {
    if (!token) return;
    const fetchId = ++fetchCountRef.current;
    if (!isSilent) {
      setLoading(true);
      setError(null);
      setNotFound(false);
      setStory(null);
    }
    try {
      const data = await fetchSharedStory(token, signal);
      if (fetchId === fetchCountRef.current) {
        setStory(data);
        setError(null);
        setNotFound(false);
      }
    } catch (err) {
      if (fetchId !== fetchCountRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      if (err instanceof PublicApiError && err.status === 404) {
        setNotFound(true);
        setStory(null);
      } else {
        setError(err instanceof Error ? err.message : 'Không thể tải truyện.');
      }
    } finally {
      if (fetchId === fetchCountRef.current && !isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const signal = controller.signal;
    void Promise.resolve().then(() => {
      if (!signal.aborted) {
        load(shareToken, signal, false);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shareToken) {
        load(shareToken, controller.signal, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shareToken, load]);

  return { story, loading, error, notFound };
}
