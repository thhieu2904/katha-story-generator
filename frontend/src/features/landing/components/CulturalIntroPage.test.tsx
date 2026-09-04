import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CulturalIntroPage } from './CulturalIntroPage';

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/language/useUiCopy', () => ({
  useUiCopy: () => ({ language: 'vi' }),
}));

describe('CulturalIntroPage', () => {
  beforeEach(() => {
    router.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves through all learning stages and loops continuously', () => {
    render(<CulturalIntroPage />);

    expect(screen.getByText('Một hình ảnh mở cánh cửa đầu tiên.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem bước trước' }));
    expect(screen.getByText('Nhìn lại điều bạn đã hiểu và nói được.')).toBeInTheDocument();
    expect(screen.getByText('05', { selector: '.katha-intro-counter strong' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem bước tiếp theo' }));
    expect(screen.getByText('Một hình ảnh mở cánh cửa đầu tiên.')).toBeInTheDocument();
  });

  it('automatically advances the horizontal journey', () => {
    vi.useFakeTimers();
    render(<CulturalIntroPage />);

    act(() => {
      vi.advanceTimersByTime(5200);
    });

    expect(screen.getByText('Làm quen với những từ khóa quan trọng.')).toBeInTheDocument();
    expect(screen.getByText('02', { selector: '.katha-intro-counter strong' })).toBeInTheDocument();
  });

  it('opens the learning and museum areas inside admin', () => {
    render(<CulturalIntroPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Tham quan bảo tàng số' }));
    expect(router.push).toHaveBeenCalledWith('/admin/museum');

    fireEvent.click(screen.getByRole('button', { name: /Khám phá Katha/ }));
    expect(router.push).toHaveBeenCalledWith('/admin/vision');
  });
});
