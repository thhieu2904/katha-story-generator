import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from './auth';
import { RequireAuth } from './RequireAuth';

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

function authenticatedReader(): AuthContextValue {
  return {
    status: 'authenticated',
    session: null,
    user: { id: 'reader-1', email: 'reader@example.com', app_role: 'reader' },
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

describe('RequireAuth', () => {
  beforeEach(() => {
    authState.value = authenticatedReader();
  });

  it('allows a verified reader to use the shared authenticated UI', () => {
    render(
      <RequireAuth>
        <div>Không gian học Katha</div>
      </RequireAuth>,
    );

    expect(screen.getByText('Không gian học Katha')).toBeInTheDocument();
    expect(authState.replace).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated visitor back to the requested page after login', async () => {
    authState.value = {
      ...authenticatedReader(),
      status: 'unauthenticated',
      user: null,
    };

    render(
      <RequireAuth>
        <div>Nội dung riêng tư</div>
      </RequireAuth>,
    );

    expect(screen.queryByText('Nội dung riêng tư')).not.toBeInTheDocument();
    expect(screen.getByText('Đang xác minh phiên đăng nhập…')).toBeInTheDocument();
    await waitFor(() => {
      expect(authState.replace).toHaveBeenCalledWith('/login?next=%2Fadmin%2Fvision');
    });
  });
});
