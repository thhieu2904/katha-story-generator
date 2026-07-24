import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError, DEFAULT_READ_TIMEOUT_MS, DEFAULT_MUTATION_TIMEOUT_MS } from './api';

// Mock supabase to return no session
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signOut: vi.fn(),
    },
  },
}));


describe('apiFetch timeout behaviour', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-spy after restore
    vi.spyOn(AbortSignal, 'timeout');

    // Default: successful fetch returning JSON
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: 1 }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET without explicit timeoutMs uses DEFAULT_READ_TIMEOUT_MS', async () => {
    await apiFetch('/api/test');

    expect(AbortSignal.timeout).toHaveBeenCalledWith(DEFAULT_READ_TIMEOUT_MS);
  });

  it('POST without explicit timeoutMs uses DEFAULT_MUTATION_TIMEOUT_MS', async () => {
    await apiFetch('/api/test', { method: 'POST', body: '{}' });

    expect(AbortSignal.timeout).toHaveBeenCalledWith(DEFAULT_MUTATION_TIMEOUT_MS);
  });

  it('POST with explicit timeoutMs overrides default', async () => {
    const customTimeout = 60_000;
    await apiFetch('/api/test', {
      method: 'POST',
      body: '{}',
      timeoutMs: customTimeout,
    });

    expect(AbortSignal.timeout).toHaveBeenCalledWith(customTimeout);
  });

  it('PUT inherits DEFAULT_MUTATION_TIMEOUT_MS', async () => {
    await apiFetch('/api/test', { method: 'PUT', body: '{}' });

    expect(AbortSignal.timeout).toHaveBeenCalledWith(DEFAULT_MUTATION_TIMEOUT_MS);
  });

  it('fetch TimeoutError becomes ApiError with status 0', async () => {
    const timeoutError = new DOMException('signal timed out', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    try {
      await apiFetch('/api/test', { method: 'POST', body: '{}' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).message).toContain('hết thời gian chờ');
    }
  });

  it('response.json() body hang triggers ApiError with status 0', async () => {
    vi.useFakeTimers();
    // Simulate: headers received (fetch resolves) but body stream hangs
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => new Promise(() => {}), // never resolves
      }),
    );

    const promise = apiFetch('/api/test', { method: 'POST', body: '{}' });
    const assertion = expect(promise).rejects.toThrow('treo khi đọc dữ liệu');

    // Advance past the body timeout
    await vi.advanceTimersByTimeAsync(DEFAULT_MUTATION_TIMEOUT_MS + 100);

    await assertion;
    vi.useRealTimers();
  });

  it('malformed JSON response body normalizes to ApiError with status 0 and cleans up timer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token in JSON')),
      }),
    );

    const promise = apiFetch('/api/test', { method: 'POST', body: '{}' });
    await expect(promise).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('bị lỗi hoặc bị treo khi đọc dữ liệu'),
    });
  });

  it('body timeout fires immediately when remaining time is already exhausted', async () => {
    vi.useFakeTimers();
    // Simulate: headers received after the full timeout has elapsed
    let callCount = 0;
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      // First call (startTime): return 0
      // Second call (elapsed check): return time > timeout to make remaining <= 0
      if (callCount <= 1) return 0;
      return DEFAULT_MUTATION_TIMEOUT_MS + 100; // elapsed > timeout
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: 1 }),
      }),
    );

    const promise = apiFetch('/api/test', { method: 'POST', body: '{}' });
    await expect(promise).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('treo khi đọc dữ liệu'),
    });

    dateNowSpy.mockRestore();
    vi.useRealTimers();
  });
});
