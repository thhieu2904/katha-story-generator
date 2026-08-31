import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchKeywordAudio, type KhmerKnowledge } from '@/features/vision/api';
import { KeywordLesson } from './KeywordLesson';

vi.mock('@/features/vision/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/vision/api')>(
    '@/features/vision/api',
  );
  return { ...actual, fetchKeywordAudio: vi.fn() };
});

const mockedFetchKeywordAudio = vi.mocked(fetchKeywordAudio);

const knowledge: KhmerKnowledge = {
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
};

describe('KeywordLesson', () => {
  beforeEach(() => {
    window.localStorage.clear();
    let objectUrl = 0;
    mockedFetchKeywordAudio.mockResolvedValue(new Blob(['wave'], { type: 'audio/wav' }));
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:keyword-${objectUrl += 1}`),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prepares every audio file, plays words, and completes the lesson', async () => {
    const onContinueToStory = vi.fn();
    render(
      <KeywordLesson
        className="angkor_wat"
        knowledge={knowledge}
        onBack={vi.fn()}
        onContinueToStory={onContinueToStory}
      />,
    );

    expect(screen.getByText('Đang chuẩn bị giọng đọc Khmer')).toBeInTheDocument();

    expect(await screen.findByText('1/3')).toBeInTheDocument();
    expect(mockedFetchKeywordAudio).toHaveBeenCalledTimes(3);
    expect(mockedFetchKeywordAudio).toHaveBeenNthCalledWith(
      1,
      'angkor_wat',
      1,
      expect.any(AbortSignal),
    );
    expect(screen.getByText('prasat Angkor Wat')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Tốc độ 0.5 lần' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tốc độ 0.75 lần' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tốc độ 1 lần' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 0.5 lần' }));
    expect(screen.getByRole('button', { name: 'Tốc độ 0.5 lần' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.localStorage.getItem('katha-keyword-playback-rate')).toBe('0.5');

    fireEvent.click(screen.getByRole('button', { name: 'Nghe từ ប្រាសាទអង្គរវត្ត' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Trình phát từ khóa Khmer')).toHaveProperty('playbackRate', 0.5);
    expect(screen.getByLabelText('Trình phát từ khóa Khmer')).toHaveProperty(
      'defaultPlaybackRate',
      0.5,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('Ngôi đền')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Từ tiếp theo →' }));
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành từ khóa')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành từ khóa' }));
    expect(screen.getByText('Bạn đã làm quen 3 từ khóa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nghe truyện →' }));
    expect(onContinueToStory).toHaveBeenCalledOnce();
  });

  it('returns to the recognition result from the first card', async () => {
    const onBack = vi.fn();
    render(
      <KeywordLesson
        className="angkor_wat"
        knowledge={knowledge}
        onBack={onBack}
        onContinueToStory={vi.fn()}
      />,
    );

    await screen.findByText('1/3');
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại kết quả' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('restores the saved playback rate after the lesson remounts', async () => {
    window.localStorage.setItem('katha-keyword-playback-rate', '0.5');

    render(
      <KeywordLesson
        className="angkor_wat"
        knowledge={knowledge}
        onBack={vi.fn()}
        onContinueToStory={vi.fn()}
      />,
    );

    await screen.findByText('1/3');
    expect(screen.getByRole('button', { name: 'Tốc độ 0.5 lần' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers retry, skip, and back when keyword audio preparation fails', async () => {
    mockedFetchKeywordAudio.mockRejectedValueOnce(new Error('audio unavailable'));
    const onBack = vi.fn();

    render(
      <KeywordLesson
        className="angkor_wat"
        knowledge={knowledge}
        onBack={onBack}
        onContinueToStory={vi.fn()}
      />,
    );

    expect(await screen.findByText('Chưa chuẩn bị được giọng đọc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử chuẩn bị lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại kết quả' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua audio' }));

    expect(await screen.findByText(/Audio từ khóa chưa sẵn sàng/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nghe từ ប្រាសាទអង្គរវត្ត' })).toBeDisabled();
    expect(screen.getByText('Chưa có audio')).toBeInTheDocument();
  });
});
