import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from './auth';
import { RequireAdmin } from './RequireAdmin';

const authState = vi.hoisted(() => ({
  value: null as AuthContextValue | null,
  replace: vi.fn(),
}));

vi.mock('./useAuth', () => ({
  useAuth: () => authState.value,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/vision',
  useRouter: () => ({ replace: authState.replace }),
}));

function verifiedAdmin(status: AuthContextValue['status']): AuthContextValue {
  return {
    status,
    session: null,
    user: { id: 'admin-1', email: 'admin@example.com', app_role: 'admin' },
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    authState.value = verifiedAdmin('authenticated');
  });

  it('keeps the lesson mounted while an existing admin session is revalidated', () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();

    function Lesson() {
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <div>Bài học đang mở</div>;
    }

    const view = render(
      <RequireAdmin>
        <Lesson />
      </RequireAdmin>,
    );

    authState.value = verifiedAdmin('loading');
    view.rerender(
      <RequireAdmin>
        <Lesson />
      </RequireAdmin>,
    );

    expect(screen.getByText('Đang xác minh phiên đăng nhập…')).toBeInTheDocument();
    expect(screen.getByText('Bài học đang mở')).toBeInTheDocument();
    expect(mounted).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();

    authState.value = verifiedAdmin('authenticated');
    view.rerender(
      <RequireAdmin>
        <Lesson />
      </RequireAdmin>,
    );

    expect(screen.queryByText('Đang xác minh phiên đăng nhập…')).not.toBeInTheDocument();
    expect(mounted).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();
  });
});
