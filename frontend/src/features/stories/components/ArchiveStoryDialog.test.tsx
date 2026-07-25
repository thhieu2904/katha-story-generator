import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ArchiveStoryDialog } from './ArchiveStoryDialog';
import { archiveStory, fetchStory } from '../api';
import { ApiError } from '@/lib/api';
import type { Story, StoryRouteKey } from '../types';

vi.mock('../api', () => ({
  archiveStory: vi.fn(),
  fetchStory: vi.fn(),
}));

const mockedArchiveStory = vi.mocked(archiveStory);
const mockedFetchStory = vi.mocked(fetchStory);

function makeStory(status: string): Story {
  return {
    id: 10,
    route_key: 's1_UkLWZg9D' as StoryRouteKey,
    title_vi: 'Test',
    title_km: null,
    description_vi: 'test',
    backbone_id: null,
    genre_id: null,
    art_style_id: null,
    target_age: 'short',
    length_pref: 'short',
    status,
    text_revision: 1,
    cover_image_url: null,
    created_by: null,
    character_ids: [],
    created_at: null,
    image_workflow_kind: null,
    updated_at: null,
  };
}

describe('ArchiveStoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onSuccess when archiveStory succeeds', async () => {
    mockedArchiveStory.mockResolvedValueOnce(makeStory('archived'));
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<ArchiveStoryDialog storyId={10} storyTitle="Test" onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it('reconciles lost ACK when archiveStory fails with status 0 and fetchStory returns status archived', async () => {
    mockedArchiveStory.mockRejectedValueOnce(new ApiError('Timeout', 0));
    mockedFetchStory.mockResolvedValueOnce(makeStory('archived'));
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<ArchiveStoryDialog storyId={10} storyTitle="Test" onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ' }));

    await waitFor(() => {
      expect(mockedFetchStory).toHaveBeenCalledWith(10);
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it('displays error message when archiveStory fails and fetchStory is not archived', async () => {
    mockedArchiveStory.mockRejectedValueOnce(new ApiError('Network error', 0));
    mockedFetchStory.mockResolvedValueOnce(makeStory('text_draft'));
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(<ArchiveStoryDialog storyId={10} storyTitle="Test" onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ' }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
