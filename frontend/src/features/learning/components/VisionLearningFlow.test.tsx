import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyImage, fetchKeywordAudio, type VisionResult } from '@/features/vision/api';
import { fetchStoryByRouteKey } from '@/features/stories/api';
import { fetchPrivateStoryLearningContext } from '@/features/reader/private-api';
import { fetchStoryImages } from '@/features/story-images/api';
import type { StoryImagesState } from '@/features/story-images/types';
import type { Story, StoryRouteKey } from '@/features/stories/types';
import { ContentLanguageProvider } from '@/features/language/ContentLanguageProvider';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { VisionLearningFlow } from './VisionLearningFlow';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/features/vision/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/vision/api')>(
    '@/features/vision/api',
  );
  return { ...actual, classifyImage: vi.fn(), fetchKeywordAudio: vi.fn() };
});

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
}));

vi.mock('@/features/stories/api', () => ({
  fetchStoryByRouteKey: vi.fn(),
}));

vi.mock('@/features/reader/private-api', () => ({
  fetchPrivateStoryLearningContext: vi.fn(),
}));

vi.mock('@/features/story-images/api', () => ({
  fetchStoryImages: vi.fn(),
}));

const mockedClassifyImage = vi.mocked(classifyImage);
const mockedFetchKeywordAudio = vi.mocked(fetchKeywordAudio);
const mockedFetchStoryByRouteKey = vi.mocked(fetchStoryByRouteKey);
const mockedFetchPrivateStoryLearningContext = vi.mocked(
  fetchPrivateStoryLearningContext,
);
const mockedFetchStoryImages = vi.mocked(fetchStoryImages);

function SwitchableVisionFlow() {
  const { setLanguage } = useContentLanguage();

  return (
    <>
      <button type="button" onClick={() => setLanguage('km')}>
        Switch to Khmer
      </button>
      <VisionLearningFlow />
    </>
  );
}

const result: VisionResult = {
  class: 'angkor_wat',
  predicted_class: 'angkor_wat',
  confidence: 0.98,
  knowledge: {
    khmer: 'ប្រាសាទអង្គរវត្ត',
    vietnamese: 'Đền Angkor Wat',
    transliteration: 'prasat Angkor Wat',
    category: 'Di sản',
    cultural_explanation: 'Giới thiệu Angkor Wat.',
    story_seed: 'Một câu chuyện tại Angkor Wat.',
    verified: true,
    sources: [],
    keywords: [
      {
        khmer: 'ប្រាសាទអង្គរវត្ត',
        vietnamese: 'Đền Angkor Wat',
        transliteration: 'prasat Angkor Wat',
      },
      { khmer: 'ប្រាសាទ', vietnamese: 'Ngôi đền', transliteration: 'prasat' },
      { khmer: 'អង្គរវត្ត', vietnamese: 'Angkor Wat', transliteration: null },
    ],
  },
};

describe('VisionLearningFlow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockedClassifyImage.mockResolvedValue(result);
    mockedFetchKeywordAudio.mockResolvedValue(new Blob(['wave'], { type: 'audio/wav' }));
    mockedFetchStoryImages.mockResolvedValue({ pages: [] } as unknown as StoryImagesState);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });
    mockPush.mockReset();
    mockReplace.mockReset();
  });

  it('changes visible interface copy when Khmer is selected', async () => {
    render(
      <ContentLanguageProvider>
        <SwitchableVisionFlow />
      </ContentLanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Khmer' }));

    expect(
      await screen.findByRole('heading', {
        name: 'ស្វែងយល់វប្បធម៌ខ្មែរតាមរយៈរូបភាព',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('បង្ហោះរូបភាព')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'ដំណើរការ' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('keeps the classification result and opens the keyword lesson', async () => {
    render(<VisionLearningFlow />);

    expect(
      await screen.findByRole('progressbar', { name: 'Tiến trình' }),
    ).toHaveAttribute('aria-valuenow', '0');

    const file = new File(['image'], 'angkor.png', { type: 'image/png' });
    fireEvent.change(await screen.findByLabelText('Tải ảnh lên'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(mockedClassifyImage).toHaveBeenCalledWith(file));
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
    fireEvent.click(await screen.findByRole('button', { name: /Bắt đầu học/ }));

    expect(await screen.findByText('1/3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '27',
    );
    expect(mockedFetchKeywordAudio).toHaveBeenCalledTimes(3);
  });

  it('asks for confirmation before resetting the whole lesson', async () => {
    render(<VisionLearningFlow />);
    const file = new File(['image'], 'angkor.png', { type: 'image/png' });
    fireEvent.change(await screen.findByLabelText('Tải ảnh lên'), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Bắt đầu học/ }));
    await screen.findByText('1/3');

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Đặt lại toàn bộ tiến trình?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại và về Nhận diện' }));
    expect(mockReplace).toHaveBeenCalledWith('/admin/vision');
    expect(window.sessionStorage.getItem('katha-vision-learning-progress-v1:admin-1')).toBeNull();
  });

  it('normalizes camera JPEG aliases before uploading the captured photo', async () => {
    render(<VisionLearningFlow />);
    const cameraFile = new File(['camera-image'], 'camera.jpg', {
      type: 'image/jpg',
      lastModified: 123,
    });

    fireEvent.change(await screen.findByLabelText('Chụp ảnh'), {
      target: { files: [cameraFile] },
    });

    await waitFor(() => expect(mockedClassifyImage).toHaveBeenCalledOnce());
    const uploadedFile = mockedClassifyImage.mock.calls[0][0];
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.name).toBe('camera.jpg');
    expect(uploadedFile.type).toBe('image/jpeg');
    expect(uploadedFile.size).toBe(cameraFile.size);
  });

  it('reopens a Vision lesson with a bundled sample and saved information', async () => {
    const storyKey = 's1_Abcdef12' as StoryRouteKey;
    window.sessionStorage.setItem(
      'katha-speaking-learning-progress-v1:private-story-7-user-admin-1',
      JSON.stringify({
        version: 1,
        stage: 'results',
        attempts: [],
        skippedSentenceIds: ['old-sentence'],
      }),
    );
    mockedFetchStoryByRouteKey.mockResolvedValue({ id: 7, route_key: storyKey } as Story);
    mockedFetchPrivateStoryLearningContext.mockResolvedValue({
      class_name: 'angkor_wat',
      knowledge: result.knowledge!,
    });
    mockedFetchStoryImages.mockResolvedValue({
      pages: [
        { page_no: 2, image_url: 'https://cdn.example/story-page-2.webp' },
        { page_no: 1, image_url: 'https://cdn.example/story-page-1.webp' },
      ],
    } as unknown as StoryImagesState);

    render(<VisionLearningFlow initialStoryKey={storyKey} />);

    expect(
      await screen.findByRole('img', { name: 'Ảnh có sẵn của bài học Vision' }),
    ).toHaveAttribute('src', 'https://cdn.example/story-page-1.webp');
    expect(screen.getByText('Thông tin bài học')).toBeInTheDocument();
    expect(screen.getByText('Ảnh bài học có sẵn')).toBeInTheDocument();
    expect(screen.getByText('Giới thiệu Angkor Wat.')).toBeInTheDocument();
    expect(screen.queryByText('Độ tin cậy')).not.toBeInTheDocument();
    expect(mockedFetchStoryByRouteKey).toHaveBeenCalledWith(storyKey);
    expect(mockedFetchPrivateStoryLearningContext).toHaveBeenCalledWith(
      7,
      expect.any(AbortSignal),
    );
    expect(mockedFetchStoryImages).toHaveBeenCalledWith(7, expect.any(AbortSignal));
    expect(mockedClassifyImage).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(
        'katha-speaking-learning-progress-v1:private-story-7-user-admin-1',
      ),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu học/ }));
    expect(await screen.findByText('1/3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành từ khóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nghe truyện →' }));

    expect(mockPush).toHaveBeenCalledWith(
      `/admin/stories/${storyKey}/read?source=vision&restart=1`,
    );
    expect(window.sessionStorage.getItem('katha-vision-story-draft-v1')).toBeNull();
  });

  it('keeps the previous progress when relearning data cannot be restored', async () => {
    const storyKey = 's1_Abcdef12' as StoryRouteKey;
    const storedVisionProgress = JSON.stringify({
      version: 1,
      result,
      keyword: { currentIndex: 1, completed: false },
    });
    const speakingStorageKey =
      'katha-speaking-learning-progress-v1:private-story-7-user-admin-1';
    const storedSpeakingProgress = JSON.stringify({
      version: 1,
      stage: 'speaking',
      attempts: [],
      skippedSentenceIds: [],
    });
    window.sessionStorage.setItem(
      'katha-vision-learning-progress-v1:admin-1',
      storedVisionProgress,
    );
    window.sessionStorage.setItem(speakingStorageKey, storedSpeakingProgress);
    mockedFetchStoryByRouteKey.mockResolvedValue({ id: 7, route_key: storyKey } as Story);
    mockedFetchPrivateStoryLearningContext.mockRejectedValueOnce(new Error('network down'));

    render(<VisionLearningFlow initialStoryKey={storyKey} />);

    expect(await screen.findByText('Không thể mở lại bài học Vision này.')).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem('katha-vision-learning-progress-v1:admin-1'),
    ).toBe(storedVisionProgress);
    expect(window.sessionStorage.getItem(speakingStorageKey)).toBe(storedSpeakingProgress);
  });

  it('restores the current keyword after auth remounts the lesson', async () => {
    const firstRender = render(<VisionLearningFlow />);
    const file = new File(['image'], 'angkor.png', { type: 'image/png' });
    fireEvent.change(await screen.findByLabelText('Tải ảnh lên'), {
      target: { files: [file] },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Bắt đầu học/ }));
    await screen.findByText('1/3');
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    expect(screen.getByText('2/3')).toBeInTheDocument();

    firstRender.unmount();
    render(<VisionLearningFlow />);

    expect(await screen.findByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('Ngôi đền')).toBeInTheDocument();
    expect(mockedClassifyImage).toHaveBeenCalledOnce();
  });

  it('hands verified knowledge to the existing story creator', async () => {
    render(<VisionLearningFlow />);
    const file = new File(['image'], 'angkor.png', { type: 'image/png' });
    fireEvent.change(await screen.findByLabelText('Tải ảnh lên'), {
      target: { files: [file] },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Bắt đầu học/ }));
    await screen.findByText('1/3');
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành từ khóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nghe truyện →' }));

    expect(mockPush).toHaveBeenCalledWith('/admin/stories/new?source=vision');
    expect(window.sessionStorage.getItem('katha-vision-story-draft-v1')).toContain(
      'Một câu chuyện tại Angkor Wat.',
    );
  });
});
