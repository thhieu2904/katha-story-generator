'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStory } from './api';
import type { Story } from './types';

interface StoryState {
  data: Story | null;
  error: string | null;
}

export function useStory(id: number) {
  const [requestId, setRequestId] = useState(0);
  const [state, setState] = useState<StoryState>({ data: null, error: null });

  useEffect(() => {
    let active = true;

    void fetchStory(id)
      .then((story) => {
        if (active) setState({ data: story, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message =
          reason instanceof Error
            ? reason.message
            : 'Không thể tải thông tin truyện.';
        setState({ data: null, error: message });
      });

    return () => {
      active = false;
    };
  }, [id, requestId]);

  const retry = useCallback(() => {
    setState({ data: null, error: null });
    setRequestId((current) => current + 1);
  }, []);

  return {
    story: state.data,
    error: state.error,
    loading: state.data === null && state.error === null,
    retry,
  };
}
