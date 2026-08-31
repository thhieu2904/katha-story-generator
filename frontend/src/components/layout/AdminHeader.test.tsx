import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminHeader } from './AdminHeader';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dictionary',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'admin@example.test' },
    signOut: vi.fn(),
  }),
}));

vi.mock('./KathaLogo', () => ({
  KathaLogo: () => <span aria-hidden="true">Katha</span>,
}));

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('AdminHeader', () => {
  it('keeps learning and dictionary inside the authenticated admin navigation', () => {
    render(<AdminHeader />);

    expect(screen.getByRole('link', { name: 'Nhận diện' })).toHaveAttribute(
      'href',
      '/admin/vision',
    );
    expect(screen.getByRole('link', { name: 'Nhân vật' })).toHaveAttribute(
      'href',
      '/admin/characters',
    );
    expect(screen.getByRole('link', { name: 'Truyện' })).toHaveAttribute(
      'href',
      '/admin/stories',
    );
    expect(screen.getByRole('link', { name: 'Từ điển' })).toHaveAttribute(
      'href',
      '/admin/dictionary',
    );
    expect(screen.getByRole('link', { name: /Bảo tàng.*Beta/i })).toHaveAttribute(
      'href',
      '/admin/museum',
    );
    expect(screen.getByRole('link', { name: 'Từ điển' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens the mobile navigation as a vertical contents sheet', () => {
    render(<AdminHeader />);

    const toggle = screen.getByRole('button', { name: 'Mở mục lục' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Đóng mục lục' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Sổ tay Katha')).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    expect(screen.getByText('Tra cứu Khmer – Việt')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Từ điển/ }).find((link) =>
        link.hasAttribute('aria-current'),
      ),
    ).toHaveAttribute('aria-current', 'page');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Sổ tay Katha').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(document.body.style.overflow).toBe('');
  });
});
