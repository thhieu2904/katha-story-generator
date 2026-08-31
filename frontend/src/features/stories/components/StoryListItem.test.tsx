import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StoryListItem as StoryListItemType, StoryRouteKey } from '../types';
import { StoryListItem } from './StoryListItem';

vi.mock('./ArchiveStoryDialog', () => ({ ArchiveStoryDialog: () => null }));

const baseStory: StoryListItemType = {
  id: 1,
  route_key: 's1_Abcdef12' as StoryRouteKey,
  title_vi: 'Truyện lễ hội',
  title_km: 'រឿងបុណ្យ',
  description_vi: 'Một câu chuyện Khmer thông thường.',
  target_age: 'early_primary',
  length_pref: 'short',
  status: 'published',
  text_revision: 1,
  image_workflow_kind: null,
  share_active: true,
  created_by: null,
  created_at: '2026-08-26T00:00:00Z',
  updated_at: '2026-08-26T00:00:00Z',
};

describe('StoryListItem', () => {
  it('places Học lại in the card footer for a readable Vision story', () => {
    render(
      <StoryListItem
        story={{
          ...baseStory,
          description_vi: 'Mã nhận diện Vision: ok_om_bok\n\nChủ đề văn hóa Khmer: Ok Om Bok',
        }}
        onArchiveSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'Học lại' })).toHaveAttribute(
      'href',
      '/admin/vision?story=s1_Abcdef12',
    );
    expect(screen.getByRole('link', { name: 'Quản lý chia sẻ' })).toBeInTheDocument();
  });

  it('does not show Học lại for a normal story', () => {
    render(<StoryListItem story={baseStory} onArchiveSuccess={vi.fn()} />);

    expect(screen.queryByRole('link', { name: 'Học lại' })).not.toBeInTheDocument();
  });

  it('shows Học lại for a legacy Vision story without the class marker', () => {
    render(
      <StoryListItem
        story={{
          ...baseStory,
          description_vi: [
            'Chủ đề văn hóa Khmer: Tượng Quan Thế Âm Bồ Tát',
            'Tên Khmer: ព្រះអវលោកេស្វរៈ',
          ].join('\n\n'),
        }}
        onArchiveSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'Học lại' })).toHaveAttribute(
      'href',
      '/admin/vision?story=s1_Abcdef12',
    );
  });
});
