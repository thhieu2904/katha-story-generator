import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { classifyImage } from './api';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

describe('classifyImage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it('normalizes a stale backend response without keywords', async () => {
    mockedApiFetch.mockResolvedValue({
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
      },
    });

    const result = await classifyImage(new File(['image'], 'angkor.png', { type: 'image/png' }));

    expect(result.knowledge?.keywords).toEqual([]);
  });
});
