import { apiFetch } from '@/lib/api';
import type {
  Story,
  StoryListItem,
  StoryCreate,
  StoryUpdate,
  Backbone,
  Genre,
  ArtStyle,
} from './types';

export function fetchStories() {
  return apiFetch<StoryListItem[]>('/api/stories');
}

export function fetchStory(id: number) {
  return apiFetch<Story>(`/api/stories/${id}`);
}

export function createStory(data: StoryCreate) {
  return apiFetch<Story>('/api/stories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateStory(id: number, data: StoryUpdate) {
  return apiFetch<Story>(`/api/stories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function archiveStory(id: number) {
  return apiFetch<Story>(`/api/stories/${id}/archive`, {
    method: 'POST',
  });
}

export function fetchBackbones() {
  return apiFetch<Backbone[]>('/api/backbones');
}

export function fetchGenres() {
  return apiFetch<Genre[]>('/api/genres');
}

export function fetchArtStyles() {
  return apiFetch<ArtStyle[]>('/api/art-styles');
}
