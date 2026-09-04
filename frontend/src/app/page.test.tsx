import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './page';

const state = vi.hoisted(() => ({
  status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated',
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push, replace: state.replace }),
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ status: state.status }),
}));

vi.mock('@/features/language/useUiCopy', () => ({
  useUiCopy: () => ({ language: 'vi', copy: { openingKatha: 'Đang mở Katha…' } }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    state.status = 'unauthenticated';
    state.push.mockReset();
    state.replace.mockReset();
  });

  it('sends an unauthenticated visitor to login', () => {
    render(<HomePage />);
    expect(state.replace).toHaveBeenCalledWith('/login');
  });

  it('opens the introduction after authentication', () => {
    state.status = 'authenticated';
    render(<HomePage />);

    expect(state.replace).toHaveBeenCalledWith('/admin/introduction');
  });
});
