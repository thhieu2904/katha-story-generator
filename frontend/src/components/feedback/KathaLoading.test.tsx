import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KathaLoadingIndicator, KathaLoadingScreen } from './KathaLoading';

describe('KathaLoading', () => {
  it('announces a full-screen loading state with optional detail', () => {
    const { container } = render(
      <KathaLoadingScreen
        label="Đang mở Katha…"
        detail="Đang chuẩn bị nội dung cho bạn."
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Đang mở Katha…');
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('Đang chuẩn bị nội dung cho bạn.')).toBeInTheDocument();
    expect(container.querySelector('.katha-loading-screen')).toBeInTheDocument();
  });

  it('supports the compact loader used inside cards and overlays', () => {
    const { container } = render(<KathaLoadingIndicator label="Đang nhận diện…" compact />);

    expect(screen.getByRole('status')).toHaveTextContent('Đang nhận diện…');
    expect(container.querySelector('.katha-loading-indicator--compact')).toBeInTheDocument();
  });

  it('renders measurable progress instead of decorative motion when progress is known', () => {
    render(
      <KathaLoadingIndicator
        label="Đang chuẩn bị giọng đọc Khmer"
        detail="Đã xong 2/4 từ"
        progress={50}
        compact
      />,
    );

    const progressbar = screen.getByRole('progressbar', {
      name: 'Đang chuẩn bị giọng đọc Khmer',
    });
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveTextContent('');
    expect(progressbar.querySelector('i')).toHaveStyle({ width: '50%' });
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
