import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount, deleteAccount, listAccounts } from './api';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public readonly status: number,
    ) {
      super(message);
    }
  },
  apiFetch: apiFetchMock,
}));

describe('account API', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({
      id: 'reader-1',
      display_name: 'Sok Dara',
      email: 'reader@example.com',
      app_role: 'reader',
      created_at: null,
      last_sign_in_at: null,
    });
  });

  it('sends account creation without exposing a Supabase secret in browser headers', async () => {
    await createAccount({
      display_name: 'Sok Dara',
      email: 'reader@example.com',
      password: 'reader-pass',
      app_role: 'admin',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/accounts', {
      method: 'POST',
      body: JSON.stringify({
        display_name: 'Sok Dara',
        email: 'reader@example.com',
        password: 'reader-pass',
        app_role: 'admin',
      }),
    });
  });

  it('lists and deletes accounts through the protected backend', async () => {
    apiFetchMock.mockResolvedValueOnce({ accounts: [] }).mockResolvedValueOnce(undefined);

    await expect(listAccounts()).resolves.toEqual([]);
    await deleteAccount('account/unsafe id');

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/auth/accounts', {
      signal: undefined,
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/accounts/account%2Funsafe%20id',
      { method: 'DELETE' },
    );
  });
});
