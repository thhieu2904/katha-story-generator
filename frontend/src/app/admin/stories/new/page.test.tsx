import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import NewStoryPage from './page';
import { createStory } from '@/features/stories/api';
import { orchestrateCreateAndGenerate } from '@/features/story-workflow/orchestration';
import { ApiError } from '@/lib/api';
import type { Story } from '@/features/stories/types';
import type { WorkflowTransitionResult } from '@/features/story-workflow/types';

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/stories/components/StorySetupForm', () => ({
  StorySetupForm: ({
    onFormChange,
    isBlocked,
  }: {
    onFormChange: (data: Record<string, unknown>, valid: boolean) => void;
    isBlocked?: boolean;
  }) => {
    const calledRef = useRef(false);
    useEffect(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onFormChange(
          {
            description_vi: 'Test story',
            backbone_id: 1,
            genre_id: 1,
            art_style_id: 1,
            target_age: 'age_3_5',
            length_pref: 'short',
            character_ids: [1],
          },
          true,
        );
      }
    }, [onFormChange]);
    return (
      <div
        data-testid="stub-form"
        data-is-blocked={String(Boolean(isBlocked))}
      />
    );
  },
}));

vi.mock('@/features/story-workflow/components/StoryWorkflowShell', () => ({
  StoryWorkflowShell: ({ children, actionBar }: { children: React.ReactNode; actionBar?: React.ReactNode }) => (
    <div>
      <div data-testid="action-bar">{actionBar}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/features/stories/api', () => ({
  createStory: vi.fn(),
}));

vi.mock('@/features/story-workflow/orchestration', () => ({
  orchestrateCreateAndGenerate: vi.fn(),
}));

vi.mock('@/features/story-workflow/mutation-helpers', () => ({
  isUncertainError: (err: unknown) => {
    if (err && typeof err === 'object' && 'status' in err) {
      return (err as { status: number }).status === 0;
    }
    return false;
  },
  isDefiniteError: () => false,
}));

const mockedCreateStory = vi.mocked(createStory);
const mockedOrchestrate = vi.mocked(orchestrateCreateAndGenerate);

describe('NewStoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"Chỉ lưu nháp" gặp ApiError(status=0) → blocked with all 5 assertions', async () => {
    mockedCreateStory.mockRejectedValueOnce(new ApiError('Timeout', 0));

    render(<NewStoryPage />);

    // Assert initial state: isBlocked is false
    expect(screen.getByTestId('stub-form')).toHaveAttribute('data-is-blocked', 'false');

    const saveButton = await screen.findByRole('button', { name: 'Chỉ lưu nháp' });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    fireEvent.click(saveButton);

    await waitFor(() => {
      // 1. Both CTAs disappear
      expect(screen.queryByRole('button', { name: 'Chỉ lưu nháp' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tạo và sinh nội dung' })).not.toBeInTheDocument();
    });

    // 2. Link to /admin/stories is present
    const links = screen.getAllByRole('link');
    const adminLink = links.find((l) => l.getAttribute('href') === '/admin/stories');
    expect(adminLink).toBeInTheDocument();

    // 3. No redirect occurred
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    // 4. Mutation called exactly ONCE
    expect(mockedCreateStory).toHaveBeenCalledOnce();

    // 5. Form received isBlocked=true
    expect(screen.getByTestId('stub-form')).toHaveAttribute('data-is-blocked', 'true');
  });

  it('"Tạo và sinh nội dung" returns { kind: \'blocked\' } → blocked with all 5 assertions', async () => {
    mockedOrchestrate.mockResolvedValueOnce({
      kind: 'blocked',
      message: 'Bản nháp có thể đã được tạo...',
    } as WorkflowTransitionResult<Story>);

    render(<NewStoryPage />);

    expect(screen.getByTestId('stub-form')).toHaveAttribute('data-is-blocked', 'false');

    const btn = await screen.findByRole('button', { name: 'Tạo và sinh nội dung' });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);

    await waitFor(() => {
      // 1. Both CTAs disappear
      expect(screen.queryByRole('button', { name: 'Chỉ lưu nháp' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tạo và sinh nội dung' })).not.toBeInTheDocument();
    });

    // 2. Link to /admin/stories is present
    const links = screen.getAllByRole('link');
    const adminLink = links.find((l) => l.getAttribute('href') === '/admin/stories');
    expect(adminLink).toBeInTheDocument();

    // 3. No redirect occurred
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    // 4. Orchestrate function called exactly ONCE
    expect(mockedOrchestrate).toHaveBeenCalledOnce();

    // 5. Form received isBlocked=true
    expect(screen.getByTestId('stub-form')).toHaveAttribute('data-is-blocked', 'true');
  });
});
