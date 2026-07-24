'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStory, fetchStoryByRouteKey } from './api';
import type { Story, StoryRouteKey } from './types';

interface StoryState {
  key: string;
  data: Story | null;
  error: string | null;
}

export function useStory(id: number) {
  const keyStr = String(id);
  const [requestId, setRequestId] = useState(0);
  const [state, setState] = useState<StoryState>({ key: keyStr, data: null, error: null });

  useEffect(() => {
    let active = true;

    void fetchStory(id)
      .then((story) => {
        if (active) setState({ key: keyStr, data: story, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message =
          reason instanceof Error
            ? reason.message
            : 'Không thể tải thông tin truyện.';
        setState({ key: keyStr, data: null, error: message });
      });

    return () => {
      active = false;
    };
  }, [id, keyStr, requestId]);

  const retry = useCallback(() => {
    setState({ key: keyStr, data: null, error: null });
    setRequestId((current) => current + 1);
  }, [keyStr]);

  const isCurrentKey = state.key === keyStr;
  const story = isCurrentKey ? state.data : null;
  const error = isCurrentKey ? state.error : null;
  const loading = !isCurrentKey || (state.data === null && state.error === null);

  return {
    story,
    error,
    loading,
    retry,
  };
}

export function useStoryByRouteKey(routeKey: StoryRouteKey) {
  const [requestId, setRequestId] = useState(0);
  const [state, setState] = useState<StoryState>({ key: routeKey, data: null, error: null });

  useEffect(() => {
    let active = true;

    void fetchStoryByRouteKey(routeKey)
      .then((story) => {
        if (active) setState({ key: routeKey, data: story, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message =
          reason instanceof Error
            ? reason.message
            : 'Không thể tải thông tin truyện.';
        setState({ key: routeKey, data: null, error: message });
      });

    return () => {
      active = false;
    };
  }, [routeKey, requestId]);

  const retry = useCallback(() => {
    setState({ key: routeKey, data: null, error: null });
    setRequestId((current) => current + 1);
  }, [routeKey]);

  const isCurrentKey = state.key === routeKey;
  const story = isCurrentKey ? state.data : null;
  const error = isCurrentKey ? state.error : null;
  const loading = !isCurrentKey || (state.data === null && state.error === null);

  return {
    story,
    error,
    loading,
    retry,
  };
}
