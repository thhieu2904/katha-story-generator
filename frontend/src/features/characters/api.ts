import { apiFetch } from '@/lib/api';
import type { Character } from './types';

export function fetchCharacters() {
  return apiFetch<Character[]>('/api/characters');
}
