'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStories } from './api';
import type { StoryListItem } from './types';

interface StoriesState {
  data: StoryListItem[] | null;
  error: string | null;
}

export function useStories() {
  const [requestId, setRequestId] = useState(0);
  const [state, setState] = useState<StoriesState>({ data: null, error: null });

  useEffect(() => {
    let active = true;

    void fetchStories()
      .then((stories) => {
        if (active) setState({ data: stories, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message =
          reason instanceof Error
            ? reason.message
            : 'Không thể tải danh sách truyện.';
        setState({ data: null, error: message });
      });

    return () => {
      active = false;
    };
  }, [requestId]);

  const retry = useCallback(() => {
    setState({ data: null, error: null });
    setRequestId((current) => current + 1);
  }, []);

  return {
    stories: state.data,
    error: state.error,
    loading: state.data === null && state.error === null,
    retry,
  };
}
