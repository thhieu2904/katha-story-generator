import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    localStorage.clear();
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
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
});
