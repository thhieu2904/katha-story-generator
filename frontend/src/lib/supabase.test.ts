import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ auth: {} })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('Supabase browser session', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://katha-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key');
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('stores authentication in sessionStorage instead of localStorage', async () => {
    window.localStorage.setItem('sb-katha-project-auth-token', 'legacy-session');

    await import('./supabase');

    expect(createClientMock).toHaveBeenCalledWith(
      'https://katha-project.supabase.co',
      'publishable-test-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          storage: window.sessionStorage,
          storageKey: 'katha-auth-session-v1',
        }),
      }),
    );
    expect(window.localStorage.getItem('sb-katha-project-auth-token')).toBeNull();
  });
});
