'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCharacters } from './api';
import type { Character } from './types';

interface CharacterState {
  data: Character[] | null;
  error: string | null;
}

export function useCharacters() {
  const [requestId, setRequestId] = useState(0);
  const [state, setState] = useState<CharacterState>({ data: null, error: null });

  useEffect(() => {
    let active = true;

    void fetchCharacters()
      .then((characters) => {
        if (active) setState({ data: characters, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message =
          reason instanceof Error
            ? reason.message
            : 'Không thể tải ngân hàng nhân vật.';
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
    characters: state.data,
    error: state.error,
    loading: state.data === null && state.error === null,
    retry,
  };
}
