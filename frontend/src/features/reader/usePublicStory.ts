import { useState, useEffect } from 'react';
import { fetchSharedStory } from './api';
import type { PublicStory } from './types';
import { PublicApiError } from '@/lib/public-api';

export function usePublicStory(shareToken: string) {
  const [story, setStory] = useState<PublicStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadStory = async () => {
      if (!shareToken) return;
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);
        const data = await fetchSharedStory(shareToken, controller.signal);
        setStory(data);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (err instanceof PublicApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        setLoading(false);
      }
    };

    loadStory();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !story && !loading && !notFound) {
        loadStory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shareToken, story, loading, notFound]);

  return { story, loading, error, notFound };
}
