import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MuseumPage } from './MuseumPage';

describe('MuseumPage', () => {
  it('embeds the beta ThingLink museum and exposes its accessible version', () => {
    render(<MuseumPage />);

    expect(screen.getByRole('heading', { name: 'Bảo tàng văn hóa Khmer' })).toHaveClass(
      'leading-[1.02]',
    );
    expect(screen.getByTitle('Phòng trưng bày văn hóa Khmer thử nghiệm')).toHaveAttribute(
      'src',
      'https://www.thinglink.com/view/scene/2152348158749836132',
    );
    expect(screen.getByRole('link', { name: /Mở phiên bản hỗ trợ tiếp cận/i })).toHaveAttribute(
      'href',
      'https://www.thinglink.com/view/scene/2152348158749836132/accessibility',
    );
    expect(
      screen.getByRole('heading', { name: 'Giai đoạn lịch sử dân tộc Khmer tại Việt Nam' }),
    ).toBeInTheDocument();
  });

  it('keeps the sticky history journey outside clipped ancestors', () => {
    render(<MuseumPage />);

    const journey = screen.getByTestId('museum-history-journey');
    const page = journey.closest('main');
    const interactiveRoom = document.getElementById('museum-interactive-room');

    expect(page).toHaveClass('bg-katha-surface', 'text-katha-text');
    expect(interactiveRoom).toHaveClass('bg-katha-surface-light', 'text-katha-text');
    expect(page).not.toHaveClass('overflow-clip');
    expect(journey.closest('.overflow-clip')).toBeNull();
  });
});
