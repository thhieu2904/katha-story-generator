import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import NewStoryPage from './page';
import { createStory } from '@/features/stories/api';
import { orchestrateCreateAndGenerate } from '@/features/story-workflow/orchestration';
import { ApiError } from '@/lib/api';
import type { Story } from '@/features/stories/types';
import type { WorkflowTransitionResult } from '@/features/story-workflow/types';
import { saveVisionStoryDraft } from '@/features/learning/visionStoryDraft';
import type { KhmerKnowledge } from '@/features/vision/api';

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
    initialDescriptionVi,
  }: {
    onFormChange: (data: Record<string, unknown>, valid: boolean) => void;
    isBlocked?: boolean;
    initialDescriptionVi?: string;
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
        data-initial-description={initialDescriptionVi || ''}
      />
    );
  },
}));

vi.mock('@/features/story-workflow/components/StoryWorkflowShell', () => ({
  StoryWorkflowShell: ({
    children,
    actionBar,
    showWorkflowStepper,
  }: {
    children: React.ReactNode;
    actionBar?: React.ReactNode;
    showWorkflowStepper?: boolean;
  }) => (
    <div data-show-workflow-stepper={String(showWorkflowStepper)}>
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
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/admin/stories/new');
  });

  it('"Chỉ lưu nháp" gặp ApiError(status=0) → blocked with all 5 assertions', async () => {
    mockedCreateStory.mockRejectedValueOnce(new ApiError('Timeout', 0));

    render(<NewStoryPage />);

    // Assert initial state: isBlocked is false
    expect(await screen.findByTestId('stub-form')).toHaveAttribute(
      'data-is-blocked',
      'false',
    );

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

    expect(await screen.findByTestId('stub-form')).toHaveAttribute(
      'data-is-blocked',
      'false',
    );

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

  it('prefills only the story description from the Vision knowledge handoff', async () => {
    const knowledge: KhmerKnowledge = {
      khmer: 'បុណ្យអកអំបុក',
      vietnamese: 'Lễ hội Ok Om Bok',
      transliteration: 'bon Ok Om Bok',
      category: 'Lễ hội',
      cultural_explanation: 'Lễ cúng Trăng của người Khmer Nam Bộ.',
      story_seed: 'Hai bạn nhỏ chuẩn bị cốm dẹp.',
      verified: true,
      sources: [],
      keywords: [{ khmer: 'បុណ្យ', vietnamese: 'Lễ hội', transliteration: 'bon' }],
    };
    saveVisionStoryDraft('ok_om_bok', knowledge);
    window.history.replaceState({}, '', '/admin/stories/new?source=vision');

    render(<NewStoryPage />);

    const form = await screen.findByTestId('stub-form');
    expect(form.getAttribute('data-initial-description')).toContain(
      'Chủ đề văn hóa Khmer: Lễ hội Ok Om Bok',
    );
    expect(screen.getByText(/Nội dung đã được lấy từ bài học Vision/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(form.closest('[data-show-workflow-stepper]')).toHaveAttribute(
      'data-show-workflow-stepper',
      'false',
    );

    expect(screen.queryByRole('button', { name: 'Quay lại' })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('katha-vision-story-draft-v1')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }));
    expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại và về Nhận diện' }));
    expect(mockReplace).toHaveBeenCalledWith('/admin/vision');
    expect(window.sessionStorage.getItem('katha-vision-story-draft-v1')).toBeNull();
  });

  it('keeps Vision stories in the normal configuration workflow after generation starts', async () => {
    const knowledge: KhmerKnowledge = {
      khmer: 'បុណ្យអកអំបុក',
      vietnamese: 'Lễ hội Ok Om Bok',
      transliteration: 'bon Ok Om Bok',
      category: 'Lễ hội',
      cultural_explanation: 'Lễ cúng Trăng của người Khmer Nam Bộ.',
      story_seed: 'Hai bạn nhỏ chuẩn bị cốm dẹp.',
      verified: true,
      sources: [],
      keywords: [{ khmer: 'បុណ្យ', vietnamese: 'Lễ hội', transliteration: 'bon' }],
    };
    saveVisionStoryDraft('ok_om_bok', knowledge);
    window.history.replaceState({}, '', '/admin/stories/new?source=vision');
    mockedOrchestrate.mockResolvedValueOnce({
      kind: 'success',
      canonical: {
        id: 42,
        route_key: 's1_vision',
        title_vi: null,
        title_km: null,
        description_vi: 'Mã nhận diện Vision: ok_om_bok',
        backbone_id: 1,
        genre_id: 1,
        art_style_id: 1,
        target_age: 'age_3_5',
        length_pref: 'short',
        status: 'generating_text',
        text_revision: 0,
        cover_image_url: null,
        created_by: null,
        character_ids: [1],
        image_workflow_kind: null,
        created_at: null,
        updated_at: null,
      },
      nextHref: '/admin/stories/s1_vision/edit',
    } as WorkflowTransitionResult<Story>);

    render(<NewStoryPage />);

    const createButton = await screen.findByRole('button', {
      name: 'Tạo và sinh nội dung',
    });
    await waitFor(() => expect(createButton).not.toBeDisabled());
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockedOrchestrate).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith('/admin/stories/s1_vision/edit');
    });
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('does not show learning progress for normal story creation', async () => {
    render(<NewStoryPage />);

    const form = await screen.findByTestId('stub-form');
    expect(screen.queryByRole('progressbar', { name: 'Tiến trình học' })).not.toBeInTheDocument();
    expect(form.closest('[data-show-workflow-stepper]')).toHaveAttribute(
      'data-show-workflow-stepper',
      'true',
    );
  });
});
