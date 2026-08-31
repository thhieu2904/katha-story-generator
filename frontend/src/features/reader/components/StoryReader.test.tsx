import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicStory } from '../types';
import { StoryReader } from './StoryReader';
import { ContentLanguageProvider } from '@/features/language/ContentLanguageProvider';

vi.mock('@/components/layout/KathaLogo', () => ({
  KathaLogo: () => <div data-testid="katha-logo" />,
}));

const story: PublicStory = {
  title_km: 'ចំណងជើងខ្មែរ',
  title_vi: 'Tiêu đề Việt',
  target_age: 'early_primary',
  page_count: 1,
  cover: { background_url: null },
  pages: [{ page_no: 1, text_km: 'ខ្មែរ', text_vi: 'Việt', image_url: null }],
};

const learningStory: PublicStory = {
  ...story,
  learning_context: {
    class_name: 'ok_om_bok',
    knowledge: {
      khmer: 'បុណ្យអកអំបុក',
      vietnamese: 'Lễ hội Ok Om Bok',
      transliteration: 'bon Ok Om Bok',
      category: 'Lễ hội',
      cultural_explanation: 'Lễ cúng Trăng của người Khmer Nam Bộ.',
      story_seed: 'Hai bạn nhỏ chuẩn bị cốm dẹp.',
      verified: true,
      sources: [],
      keywords: [
        { khmer: 'បុណ្យ', vietnamese: 'Lễ hội', transliteration: 'bon' },
        { khmer: 'អកអំបុក', vietnamese: 'Ok Om Bok', transliteration: null },
        { khmer: 'ព្រះចន្ទ', vietnamese: 'Mặt Trăng', transliteration: 'preah chan' },
      ],
    },
  },
};

function renderReader(reader: React.ReactElement) {
  return render(<ContentLanguageProvider>{reader}</ContentLanguageProvider>);
}

describe('StoryReader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    let objectUrlIndex = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => `blob:khmer-audio-${++objectUrlIndex}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(['RIFF-wave'], { type: 'audio/wav' })),
    }));
  });

  it('persists language selection and updates the primary cover title', () => {
    renderReader(<StoryReader story={story} />);

    fireEvent.click(screen.getByRole('radio', { name: 'ខ្មែរ' }));

    expect(localStorage.getItem('katha-content-language-v1')).toBe('km');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ចំណងជើងខ្មែរ');
    expect(screen.getByRole('button', { name: 'ទំព័របន្ទាប់' })).toBeInTheDocument();
  });

  it('restores a saved language after hydration', async () => {
    localStorage.setItem('katha-content-language-v1', 'vi');
    renderReader(<StoryReader story={story} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tiêu đề Việt');
    });
  });

  it('highlights learned vocabulary in both story languages', async () => {
    const highlightedStory: PublicStory = {
      ...learningStory,
      pages: [
        {
          page_no: 1,
          text_km: 'ថ្ងៃបុណ្យ កុមារមើលព្រះចន្ទ។',
          text_vi: 'Lễ hội diễn ra dưới ánh Mặt Trăng.',
          image_url: null,
        },
      ],
    };
    renderReader(<StoryReader story={highlightedStory} initialLearningActive />);

    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));
    expect(screen.getByText('Lễ hội', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getByText('Mặt Trăng', { selector: 'mark' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'ខ្មែរ' }));
    await waitFor(() => {
      expect(screen.getByText('បុណ្យ', { selector: 'mark' })).toBeInTheDocument();
      expect(screen.getByText('ព្រះចន្ទ', { selector: 'mark' })).toBeInTheDocument();
    });
  });

  it('confirms before resetting a private learning journey', () => {
    const onResetLearningJourney = vi.fn();
    renderReader(
      <StoryReader
        story={learningStory}
        initialLearningActive
        onResetLearningJourney={onResetLearningJourney}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }));
    expect(onResetLearningJourney).not.toHaveBeenCalled();
    expect(screen.getByText(/Truyện đã sinh hoặc truyện đang Học lại vẫn được giữ nguyên/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại và về Nhận diện' }));
    expect(onResetLearningJourney).toHaveBeenCalledOnce();
  });

  it('hides only the reader navbar while scrolling down, then shows it on scroll up', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    renderReader(<StoryReader story={learningStory} initialLearningActive />);
    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));

    const chrome = screen.getByTestId('reader-chrome');
    expect(chrome).toHaveAttribute('data-expanded', 'true');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 120,
    });
    fireEvent.scroll(window);
    await waitFor(() => expect(chrome).toHaveAttribute('data-expanded', 'false'));
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toBeVisible();

    now.mockReturnValue(1_500);
    const unrelatedScrollRegion = document.createElement('div');
    document.body.appendChild(unrelatedScrollRegion);
    fireEvent.scroll(unrelatedScrollRegion);
    expect(chrome).toHaveAttribute('data-expanded', 'false');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 60,
    });
    fireEvent.scroll(window);
    await waitFor(() => expect(chrome).toHaveAttribute('data-expanded', 'true'));
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toBeVisible();
  });

  it('keeps the current scroll position when changing story pages', () => {
    renderReader(<StoryReader story={story} />);

    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('starts a requested keyword review and continues into the existing narrated story', async () => {
    renderReader(
      <StoryReader
        story={learningStory}
        shareToken={'T'.repeat(43)}
        initialLearningActive
        initialLearningMode="keywords"
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Tiếng Việt' }));

    expect(await screen.findByText('1/3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành từ khóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nghe truyện →' }));

    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(fetch).toHaveBeenCalledTimes(4);
    for (const [, options] of vi.mocked(fetch).mock.calls) {
      expect(options?.method).not.toBe('POST');
    }
  });

  it('starts the reader fresh after relearning instead of restoring old results', async () => {
    const learningSessionKey = 'private-story-5-user-admin-1';
    const onRestartLearningSessionConsumed = vi.fn();
    sessionStorage.setItem(
      `katha-speaking-learning-progress-v1:${learningSessionKey}`,
      JSON.stringify({
        version: 1,
        stage: 'results',
        attempts: [],
        skippedSentenceIds: ['old-skipped-sentence'],
      }),
    );

    renderReader(
      <StoryReader
        story={learningStory}
        shareToken={'T'.repeat(43)}
        initialLearningActive
        learningSessionKey={learningSessionKey}
        restartLearningSession
        onRestartLearningSessionConsumed={onRestartLearningSessionConsumed}
      />,
    );

    await waitFor(() => {
      expect(
        sessionStorage.getItem(`katha-speaking-learning-progress-v1:${learningSessionKey}`),
      ).toBeNull();
    });
    expect(onRestartLearningSessionConsumed).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Tiêu đề Việt' })).toBeInTheDocument();
    expect(screen.queryByText('Kết quả hành trình học')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tiếp tục luyện nói/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    expect(screen.getByTestId('reader-page-transition')).toHaveAttribute(
      'data-direction',
      'forward',
    );
    expect(screen.getByRole('button', { name: /Tiếp tục luyện nói/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    expect(screen.getByTestId('reader-page-transition')).toHaveAttribute(
      'data-direction',
      'backward',
    );
  });

  it('returns to the current story recognition step when restarting the lesson', async () => {
    const learningSessionKey = 'private-story-5-user-admin-1';
    const onResetLearningJourney = vi.fn();
    const onRestartLearningJourney = vi.fn();
    const storageKey = `katha-speaking-learning-progress-v1:${learningSessionKey}`;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        stage: 'results',
        attempts: [],
        skippedSentenceIds: ['skipped-sentence'],
      }),
    );

    renderReader(
      <StoryReader
        story={learningStory}
        initialLearningActive
        learningSessionKey={learningSessionKey}
        onRestartLearningJourney={onRestartLearningJourney}
        onResetLearningJourney={onResetLearningJourney}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Kết quả hành trình học' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Luyện lại từ đầu/i }));

    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(onRestartLearningJourney).toHaveBeenCalledOnce();
    expect(onResetLearningJourney).not.toHaveBeenCalled();
  });

  it('prepares all Khmer narration before playing the first page', async () => {
    renderReader(<StoryReader story={story} shareToken={'T'.repeat(43)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));

    const audio = screen.getByLabelText('Trình đọc truyện Khmer tự động');
    expect(screen.getByRole('status')).toHaveTextContent('Đã xong 0/1 trang');
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:8000/api/public/shared-stories/${'T'.repeat(43)}/pages/1/audio`,
      expect.objectContaining({ headers: { Accept: 'audio/wav' } }),
    );
    expect(audio).toHaveAttribute('src', 'blob:khmer-audio-1');
  });

  it('shows speaking after reaching the final story page without requiring narration to finish', async () => {
    const twoPageLearningStory: PublicStory = {
      ...learningStory,
      page_count: 2,
      pages: [
        learningStory.pages[0],
        { page_no: 2, text_km: 'ទំព័រទីពីរ', text_vi: 'Trang hai', image_url: null },
      ],
    };

    renderReader(
      <StoryReader
        story={twoPageLearningStory}
        shareToken={'T'.repeat(43)}
        initialLearningActive
      />,
    );

    expect(screen.queryByRole('button', { name: /Tiếp tục luyện nói/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: /Tiếp tục luyện nói/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByRole('button', { name: /Tiếp tục luyện nói/i })).toBeInTheDocument();

    const audio = screen.getByLabelText('Trình đọc truyện Khmer tự động');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 10 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 5 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );

    fireEvent.pause(audio);
    expect(screen.getByRole('progressbar', { name: 'Tiến trình' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );
  });

  it('keeps a normal reader unchanged after narration finishes', async () => {
    renderReader(<StoryReader story={learningStory} shareToken={'T'.repeat(43)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));
    const audio = screen.getByLabelText('Trình đọc truyện Khmer tự động');
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    fireEvent.ended(audio);

    expect(screen.queryByRole('progressbar', { name: 'Tiến trình' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tiếp tục luyện nói/i })).not.toBeInTheDocument();
  });

  it('prepares every page, then automatically turns and narrates the next page', async () => {
    const twoPageStory: PublicStory = {
      ...story,
      page_count: 2,
      pages: [
        story.pages[0],
        { page_no: 2, text_km: 'ទំព័រទីពីរ', text_vi: 'Trang hai', image_url: null },
      ],
    };
    renderReader(<StoryReader story={twoPageStory} shareToken={'T'.repeat(43)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));
    const audio = screen.getByLabelText('Trình đọc truyện Khmer tự động');
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.ended(audio);

    await waitFor(() => expect(screen.getByText('Trang hai')).toBeInTheDocument());
    await waitFor(() => {
      expect(audio).toHaveAttribute('src', 'blob:khmer-audio-2');
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    });
  });

  it('does not start playback while the final page audio is still generating', async () => {
    const twoPageStory: PublicStory = {
      ...story,
      page_count: 2,
      pages: [
        story.pages[0],
        { page_no: 2, text_km: 'ទំព័រទីពីរ', text_vi: 'Trang hai', image_url: null },
      ],
    };
    let finishLastPage!: (response: Response) => void;
    const lastPageResponse = new Promise<Response>((resolve) => {
      finishLastPage = resolve;
    });
    const audioResponse = {
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(['RIFF-wave'], { type: 'audio/wav' })),
    } as unknown as Response;
    vi.mocked(fetch)
      .mockResolvedValueOnce(audioResponse)
      .mockReturnValueOnce(lastPageResponse);

    renderReader(<StoryReader story={twoPageStory} shareToken={'T'.repeat(43)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã xong 1/2 trang'));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await act(async () => finishLastPage(audioResponse));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
  });
});
