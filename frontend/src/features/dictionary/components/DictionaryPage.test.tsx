import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDictionary, fetchDictionaryAudio } from '../api';
import { DictionaryPage } from './DictionaryPage';

vi.mock('../api', () => ({
  fetchDictionary: vi.fn(),
  fetchDictionaryAudio: vi.fn(),
}));

describe('DictionaryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(fetchDictionary).mockResolvedValue({
      source: 'Kiêm Hạnh',
      query: '',
      items: [
        {
          id: 3,
          khmer: 'កដប',
          vietnamese: 'Cổ chai',
          transliteration: 'kadaba',
          transliteration_reviewed: false,
          page: 2,
          quality: 'Cao',
        },
      ],
      total: 1,
      page: 1,
      page_size: 24,
      total_pages: 1,
    });
    vi.mocked(fetchDictionaryAudio).mockResolvedValue(
      new Blob(['RIFFxxxxWAVEaudio'], { type: 'audio/wav' }),
    );
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:dictionary-entry-3'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('shows transliteration, opens entry details, and plays canonical Khmer audio', async () => {
    render(<DictionaryPage />);

    expect(await screen.findByText('kadaba')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở chi tiết từ កដប' }));

    const dialog = screen.getByRole('dialog', { name: 'កដប' });
    expect(within(dialog).getByText('Cổ chai')).toBeInTheDocument();
    expect(within(dialog).getByText('kadaba')).toHaveClass(
      'break-words',
      '[overflow-wrap:anywhere]',
    );
    expect(within(dialog).getByText(/Phiên âm tự động để tham khảo/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nghe từ កដប' }));

    await waitFor(() => expect(fetchDictionaryAudio).toHaveBeenCalledWith(3, expect.any(AbortSignal)));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    const audio = screen.getByLabelText('Trình phát âm từ điển Khmer') as HTMLAudioElement;
    expect(audio.playbackRate).toBe(0.8);
    expect(audio.preservesPitch).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tốc độ 0.7 lần' }));
    expect(audio.playbackRate).toBe(0.7);
  });
});
