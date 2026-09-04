import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KhmerHistoryTimeline } from './KhmerHistoryTimeline';

describe('KhmerHistoryTimeline', () => {
  it('opens a fullscreen historical dossier with references and resets scroll between eras', () => {
    render(<KhmerHistoryTimeline />);

    const firstStage = screen.getByRole('button', {
      name: /Văn hóa Óc Eo & Vương quốc Phù Nam/i,
    });
    fireEvent.click(firstStage);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('h-[100svh]', 'max-h-none', 'max-w-none');
    expect(
      within(dialog).getByRole('heading', { name: 'Văn hóa Óc Eo & Vương quốc Phù Nam' }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Thế kỷ I – VII/i)[0]).toBeInTheDocument();
    expect(within(dialog).getByText(/Bình minh châu thổ và thương cảng quốc tế cổ đại/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Con dấu chữ Phạn cổ/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Nguồn tham khảo')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', { name: /Khu di tích khảo cổ Óc Eo – Ba Thê/i }),
    ).toHaveAttribute('href', 'https://whc.unesco.org/en/tentativelists/6572');

    const viewport = screen.getByTestId('museum-history-dossier-viewport');
    const content = screen.getByTestId('museum-history-dossier-content');
    viewport.scrollTop = 500;
    content.scrollTop = 500;

    const nextButton = within(dialog).getByRole('button', {
      name: /Thời kỳ Thủy Chân Lạp & Châu thổ Mekong/i,
    });
    fireEvent.click(nextButton);

    expect(
      within(dialog).getByRole('heading', { name: 'Thời kỳ Thủy Chân Lạp & Châu thổ Mekong' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('museum-history-dossier-viewport')).toHaveProperty('scrollTop', 0);
    expect(screen.getByTestId('museum-history-dossier-content')).toHaveProperty('scrollTop', 0);
    expect(
      within(dialog).getByRole('link', { name: /Khu đền Sambor Prei Kuk/i }),
    ).toHaveAttribute('href', 'https://whc.unesco.org/en/list/1532');
  });

  it('pins one milestone at a time and advances from scroll events outside window', async () => {
    render(<KhmerHistoryTimeline />);

    const journey = screen.getByTestId('museum-history-journey');
    const activeStage = screen.getByTestId('museum-history-active-stage');

    expect(journey).toHaveStyle({ height: '700vh' });
    expect(activeStage).toHaveTextContent('Văn hóa Óc Eo & Vương quốc Phù Nam');
    expect(screen.queryByText('Thời kỳ Thủy Chân Lạp & Châu thổ Mekong')).not.toBeInTheDocument();

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    Object.defineProperty(journey, 'offsetHeight', { configurable: true, value: 7000 });
    vi.spyOn(journey, 'getBoundingClientRect').mockReturnValue({
      top: -3000,
      bottom: 4000,
      left: 0,
      right: 1000,
      width: 1000,
      height: 7000,
      x: 0,
      y: -3000,
      toJSON: () => ({}),
    });

    fireEvent.scroll(journey.parentElement!);

    await waitFor(() => {
      expect(screen.getByTestId('museum-history-active-stage')).toHaveTextContent(
        'Tụ cư & Hệ thống Chùa Tháp Nam Bộ',
      );
    });
    expect(screen.queryByText('Văn hóa Óc Eo & Vương quốc Phù Nam')).not.toBeInTheDocument();
  });

  it('shows the journey direction and current station without rendering a milestone list', () => {
    render(<KhmerHistoryTimeline />);

    expect(
      screen.getByRole('heading', { name: 'Văn hóa Óc Eo & Vương quốc Phù Nam' }),
    ).toHaveClass('leading-[1.08]');
    expect(screen.getByText(/Quá khứ · Thế kỷ I/i)).toBeInTheDocument();
    expect(screen.getByText(/Hiện tại · Thế kỷ XXI/i)).toBeInTheDocument();
    expect(screen.getByText(/01 \/ 06/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
