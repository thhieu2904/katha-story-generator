import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublicStory } from '../types';
import { StoryCover } from './StoryCover';

const firstPageImage = 'https://example.test/page-one.webp';
const coverImage = 'https://example.test/cover.webp';

function createStory(backgroundUrl: string | null = coverImage): PublicStory {
  return {
    title_km: 'ចំណងជើងខ្មែរ',
    title_vi: 'Tiêu đề Việt',
    target_age: 'early_primary',
    page_count: 1,
    cover: { background_url: backgroundUrl },
    pages: [{ page_no: 1, text_km: 'ខ្មែរ', text_vi: 'Việt', image_url: firstPageImage }],
  };
}

describe('StoryCover', () => {
  it('uses the explicit cover image as the primary artwork without cropping it', () => {
    render(<StoryCover story={createStory()} language="km" />);

    const image = screen.getByRole('img', { name: 'Bìa truyện: ចំណងជើងខ្មែរ' });
    expect(image).toHaveAttribute('src', coverImage);
    expect(image).toHaveClass('object-contain');
    expect(image).not.toHaveClass('object-cover');
  });

  it('falls back to the first page image when the cover URL is empty', () => {
    render(<StoryCover story={createStory(null)} language="km" />);

    expect(screen.getByRole('img', { name: 'Bìa truyện: ចំណងជើងខ្មែរ' })).toHaveAttribute('src', firstPageImage);
  });

  it('renders an accessible fallback when neither cover nor first page has an image', () => {
    const story = createStory(null);
    story.pages[0].image_url = null;
    render(<StoryCover story={story} language="km" />);

    expect(screen.getByRole('img', { name: 'Chưa có ảnh bìa truyện' })).toBeInTheDocument();
  });

  it('makes the selected language title primary', () => {
    const story = createStory();
    const { rerender } = render(<StoryCover story={story} language="km" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ចំណងជើងខ្មែរ');
    rerender(<StoryCover story={story} language="vi" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tiêu đề Việt');
  });
});
