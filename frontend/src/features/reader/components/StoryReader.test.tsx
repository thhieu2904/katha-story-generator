import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicStory } from '../types';
import { StoryReader } from './StoryReader';

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

describe('StoryReader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
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
    render(<StoryReader story={story} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Tiếng Việt' }));

    expect(localStorage.getItem('katha-reader-lang')).toBe('vi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tiêu đề Việt');
  });

  it('restores a saved language after hydration', async () => {
    localStorage.setItem('katha-reader-lang', 'vi');
    render(<StoryReader story={story} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tiêu đề Việt');
    });
  });

  it('prepares all Khmer narration before playing the first page', async () => {
    render(<StoryReader story={story} shareToken={'T'.repeat(43)} />);

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

  it('prepares every page, then automatically turns and narrates the next page', async () => {
    const twoPageStory: PublicStory = {
      ...story,
      page_count: 2,
      pages: [
        story.pages[0],
        { page_no: 2, text_km: 'ទំព័រទីពីរ', text_vi: 'Trang hai', image_url: null },
      ],
    };
    render(<StoryReader story={twoPageStory} shareToken={'T'.repeat(43)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));
    const audio = screen.getByLabelText('Trình đọc truyện Khmer tự động');
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.ended(audio);

    expect(screen.getByText('ទំព័រទីពីរ')).toBeInTheDocument();
    expect(audio).toHaveAttribute(
      'src',
      'blob:khmer-audio-2',
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
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

    render(<StoryReader story={twoPageStory} shareToken={'T'.repeat(43)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đọc truyện' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã xong 1/2 trang'));
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await act(async () => finishLastPage(audioResponse));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
  });
});
