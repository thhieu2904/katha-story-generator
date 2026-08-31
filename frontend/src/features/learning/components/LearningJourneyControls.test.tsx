import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningJourneyControls } from './LearningJourneyControls';

describe('LearningJourneyControls', () => {
  it('confirms before resetting the full journey', () => {
    const onReset = vi.fn();

    render(<LearningJourneyControls language="vi" onReset={onReset} />);
    expect(screen.queryByRole('button', { name: 'Quay lại' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }));
    expect(onReset).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Đặt lại toàn bộ tiến trình?' });
    expect(dialog).toHaveTextContent(
      'Truyện đã sinh hoặc truyện đang Học lại vẫn được giữ nguyên',
    );
    expect(dialog.parentElement?.parentElement).toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại và về Nhận diện' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
