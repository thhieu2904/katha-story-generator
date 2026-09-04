import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminHeader } from './AdminHeader';

const authState = vi.hoisted(() => ({
  user: { email: 'admin@example.test', app_role: 'admin' as 'admin' | 'reader' },
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dictionary',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('./KathaLogo', () => ({
  KathaLogo: () => <span aria-hidden="true">Katha</span>,
}));

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('AdminHeader', () => {
  it('keeps the learning areas inside the shared authenticated navigation', () => {
    authState.user = { email: 'admin@example.test', app_role: 'admin' };
    render(<AdminHeader />);

    expect(screen.getByRole('link', { name: 'Chính' })).toHaveAttribute(
      'href',
      '/admin/introduction',
    );
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
    expect(screen.getByRole('link', { name: 'Tài khoản' })).toHaveAttribute(
      'href',
      '/admin/accounts',
    );
    expect(screen.getByRole('link', { name: 'Từ điển' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByText('Admin')).not.toHaveLength(0);
    expect(screen.queryByText('admin@example.test')).not.toBeInTheDocument();
  });

  it('opens the mobile navigation as a vertical contents sheet', () => {
    authState.user = { email: 'admin@example.test', app_role: 'admin' };
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

  it('hides account management from readers on desktop and mobile', () => {
    authState.user = { email: 'reader@example.test', app_role: 'reader' };
    render(<AdminHeader />);

    expect(screen.queryByRole('link', { name: 'Tài khoản' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mở mục lục' }));
    expect(screen.queryByRole('link', { name: /Tài khoản/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Reader')).not.toHaveLength(0);
    expect(screen.queryByText('reader@example.test')).not.toBeInTheDocument();
  });
});
