import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MuseumPage } from './MuseumPage';

describe('MuseumPage', () => {
  it('embeds the beta ThingLink museum and exposes its accessible version', () => {
    render(<MuseumPage />);

    expect(screen.getByRole('heading', { name: 'Bảo tàng văn hóa Khmer' })).toBeInTheDocument();
    expect(screen.getByTitle('Phòng trưng bày văn hóa Khmer thử nghiệm')).toHaveAttribute(
      'src',
      'https://www.thinglink.com/view/scene/2149874779585250148',
    );
    expect(screen.getByRole('link', { name: /Mở phiên bản hỗ trợ tiếp cận/i })).toHaveAttribute(
      'href',
      'https://www.thinglink.com/view/scene/2149874779585250148/accessibility',
    );
  });
});
