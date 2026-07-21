import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StoryImagePage } from '../types';
import { GeneratedImageCard } from './GeneratedImageCard';

function page(overrides: Partial<StoryImagePage> = {}): StoryImagePage {
  return {
    id: 1,
    page_no: 1,
    text_vi: 'Trang kiểm thử.',
    text_km: 'ទំព័រសាកល្បង។',
    text_en: 'A test page.',
    image_scene_en: 'A test scene.',
    image_prompt_en: 'A test prompt.',
    character_ids: [],
    image_status: 'completed',
    image_url: 'https://assets.example.test/old.webp',
    image_attempt_count: 1,
    image_error_code: null,
    updated_at: null,
    ...overrides,
  };
}

describe('GeneratedImageCard', () => {
  it('tries a newly returned image URL after the previous URL failed', () => {
    const { rerender } = render(<GeneratedImageCard page={page()} />);
    fireEvent.error(screen.getByRole('img', { name: 'Minh họa trang 1' }));
    expect(screen.queryByRole('img', { name: 'Minh họa trang 1' })).not.toBeInTheDocument();

    rerender(
      <GeneratedImageCard
        page={page({ image_url: 'https://assets.example.test/new.webp' })}
      />,
    );

    expect(screen.getByRole('img', { name: 'Minh họa trang 1' })).toBeInTheDocument();
  });

  it.each([
    ['JOB_INTERRUPTED', 'Job sinh ảnh bị gián đoạn. Trang này có thể được thử lại.'],
    ['STALE_JOB_INTERRUPTED', 'Job sinh ảnh cũ đã hết hạn. Trang này có thể được tiếp tục.'],
  ])('renders the %s recovery label', (errorCode, label) => {
    render(
      <GeneratedImageCard
        page={page({ image_status: 'failed', image_url: null, image_error_code: errorCode })}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});