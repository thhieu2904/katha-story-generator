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
  const loadingOwnerRef = useRef(0);
  const currentTokenRef = useRef<string | null>(null);
  const storyRef = useRef<PublicStory | null>(null);
  const authoritativeOutcomeRef = useRef<{
    token: string;
    fetchId: number;
  } | null>(null);

  const load = useCallback(async (token: string, signal?: AbortSignal, isSilent = false) => {
    if (!token) return;
    const fetchId = ++fetchCountRef.current;
    const loadingOwner = isSilent ? null : ++loadingOwnerRef.current;
    if (!isSilent) {
      currentTokenRef.current = token;
      storyRef.current = null;
      authoritativeOutcomeRef.current = null;
      setLoading(true);
      setError(null);
      setNotFound(false);
      setStory(null);
    }
    try {
      const data = await fetchSharedStory(token, signal);
      const newerAuthoritativeOutcome = authoritativeOutcomeRef.current;
      if (
        token === currentTokenRef.current &&
        (
          fetchId === fetchCountRef.current ||
          (!isSilent &&
            storyRef.current === null &&
            (!newerAuthoritativeOutcome ||
              newerAuthoritativeOutcome.token !== token ||
              newerAuthoritativeOutcome.fetchId <= fetchId))
        )
      ) {
        authoritativeOutcomeRef.current = { token, fetchId };
        storyRef.current = data;
        setStory(data);
        setError(null);
        setNotFound(false);
      }
    } catch (err) {
      if (fetchId !== fetchCountRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      if (err instanceof PublicApiError && err.status === 404) {
        // A newer 404 is authoritative: an older foreground response may not
        // resurrect a link that has just been revoked or rotated.
        authoritativeOutcomeRef.current = { token, fetchId };
        storyRef.current = null;
        setNotFound(true);
        setStory(null);
        // A terminal 404 must not wait forever for an older initial request.
        loadingOwnerRef.current += 1;
        setLoading(false);
      } else {
        if (isSilent && storyRef.current !== null) return;
        setError(err instanceof Error ? err.message : 'Không thể tải truyện.');
      }
    } finally {
      if (loadingOwner !== null && loadingOwner === loadingOwnerRef.current) {
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
