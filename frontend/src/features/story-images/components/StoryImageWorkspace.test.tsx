import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryImagesState } from '../types';
import { useStoryImages } from '../useStoryImages';
import { StoryImageWorkspace } from './StoryImageWorkspace';

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerMocks.replace }),
}));

vi.mock('../useStoryImages', () => ({
  useStoryImages: vi.fn(),
}));

const mockedUseStoryImages = vi.mocked(useStoryImages);

function imageState(overrides: Partial<StoryImagesState> = {}): StoryImagesState {
  return {
    story_id: 10,
    title_vi: 'Truyện kiểm thử',
    status: 'text_confirmed',
    text_revision: 1,
    image_plan_revision: 2,
    image_plan_ready: true,
    mapping_locked: false,
    job_id: null,
    job_stale: false,
    can_start: true,
    can_retry: false,
    can_resume: false,
    progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
    available_characters: [],
    pages: [],
    ...overrides,
  };
}

function hookState(
  overrides: Partial<ReturnType<typeof useStoryImages>> = {}
): ReturnType<typeof useStoryImages> {
  return {
    imageState: imageState(),
    draftMappings: {},
    mappingDirty: false,
    loading: false,
    error: null,
    pollError: null,
    notice: null,
    pending: null,
    blocked: false,
    redirectHref: null,
    activePage: null,
    canPreparePlan: false,
    canEditMapping: true,
    refresh: vi.fn().mockResolvedValue(undefined),
    updatePageCharacters: vi.fn(),
    preparePlan: vi.fn().mockResolvedValue(false),
    saveMapping: vi.fn().mockResolvedValue(null),
    startGeneration: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('StoryImageWorkspace generation dialog reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['generating_images', 'pending_review'])(
    'closes the stale modal after reconciliation installs %s',
    async (status) => {
      mockedUseStoryImages.mockReturnValue(hookState());
      const { rerender } = render(<StoryImageWorkspace storyId={10} />);

      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu sinh/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const refresh = vi.fn().mockResolvedValue(undefined);
      mockedUseStoryImages.mockReturnValue(
        hookState({
          blocked: true,
          error: 'Chưa thể đối soát trạng thái mới nhất.',
          refresh,
        })
      );
      rerender(<StoryImageWorkspace storyId={10} />);
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Kiểm tra lại trạng thái',
        })
      );
      expect(refresh).toHaveBeenCalledOnce();

      mockedUseStoryImages.mockReturnValue(
        hookState({
          imageState: imageState({
            status,
            mapping_locked: true,
            can_start: false,
            progress:
              status === 'generating_images'
                ? { total: 1, pending: 0, generating: 1, completed: 0, failed: 0 }
                : { total: 1, pending: 0, generating: 0, completed: 1, failed: 0 },
          }),
        })
      );
      rerender(<StoryImageWorkspace storyId={10} />);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    }
  );

  it('updates an open dialog to the canonical retry action', async () => {
    mockedUseStoryImages.mockReturnValue(hookState());
    const { rerender } = render(<StoryImageWorkspace storyId={10} />);

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu sinh/i }));

    mockedUseStoryImages.mockReturnValue(
      hookState({
        imageState: imageState({
          mapping_locked: true,
          can_start: false,
          can_retry: true,
          progress: { total: 2, pending: 0, generating: 0, completed: 1, failed: 1 },
        }),
      })
    );
    rerender(<StoryImageWorkspace storyId={10} />);

    expect(
      await screen.findByRole('heading', { name: 'Thử lại các trang còn thiếu' })
    ).toBeInTheDocument();
  });
});