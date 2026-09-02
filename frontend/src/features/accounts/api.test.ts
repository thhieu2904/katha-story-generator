import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReaderAccount } from './api';

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

describe('createReaderAccount', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
    apiFetchMock.mockResolvedValue({
      id: 'reader-1',
      email: 'reader@example.com',
      app_role: 'reader',
      confirmation_required: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the authenticated reader-creation request with the configured publishable key', async () => {
    await createReaderAccount({
      email: 'reader@example.com',
      password: 'reader-pass',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/readers', {
      method: 'POST',
      headers: {
        'X-Supabase-Publishable-Key': 'publishable-test-key',
      },
      body: JSON.stringify({
        email: 'reader@example.com',
        password: 'reader-pass',
      }),
    });
  });
});
