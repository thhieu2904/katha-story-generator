import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Default timeout for GET requests to prevent infinite loading states. */
export const DEFAULT_READ_TIMEOUT_MS = 20_000;

/**
 * Default timeout for mutation requests (POST, PUT, PATCH, DELETE).
 * Fast DB/local mutations (create, confirm, save mapping) use this default.
 * AI/long-running mutations override with explicit timeoutMs (30–285s).
 * Timeout is treated as uncertain outcome: no auto-retry, canonical reread required.
 */
export const DEFAULT_MUTATION_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestInit extends RequestInit {
  accessToken?: string;
  timeoutMs?: number;
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') {
      return body.detail;
    }
  } catch {
    // The API or proxy returned a non-JSON body.
  }

  if (response.status === 401) return 'Phiên đăng nhập đã hết hạn.';
  if (response.status === 403) return 'Tài khoản không có quyền quản trị.';
  return 'Không thể kết nối với máy chủ. Vui lòng thử lại.';
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestInit = {},
): Promise<T> {
  const {
    accessToken,
    timeoutMs,
    headers: callerHeaders,
    signal: callerSignal,
    ...requestOptions
  } = options;
  const headers = new Headers(callerHeaders);
  let token = accessToken;
  if (!token && supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (requestOptions.body && !(requestOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (requestOptions.method || 'GET').toUpperCase();
  const effectiveTimeout = timeoutMs ?? (method === 'GET' ? DEFAULT_READ_TIMEOUT_MS : DEFAULT_MUTATION_TIMEOUT_MS);
  const timeoutSignal = effectiveTimeout ? AbortSignal.timeout(effectiveTimeout) : undefined;
  const signal = callerSignal && timeoutSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : callerSignal || timeoutSignal;

  const startTime = Date.now();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(
        'Yêu cầu đã hết thời gian chờ. Đang kiểm tra lại trạng thái truyện.',
        0,
      );
    }
    throw new ApiError('Không thể kết nối với máy chủ. Vui lòng thử lại.', 0);
  }

  if (!response.ok) {
    const message = await safeErrorMessage(response);
    if (response.status === 401 && supabase) {
      await supabase.auth.signOut();
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // Guard against response body stream hanging after headers have been received.
  // Single overall deadline is calculated by deducting elapsed fetch time.
  // Guaranteed timer cleanup is performed in the finally block.
  let bodyTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (effectiveTimeout) {
      const elapsed = Date.now() - startTime;
      const remainingTimeout = effectiveTimeout - elapsed;
      if (remainingTimeout <= 0) {
        throw new ApiError('Phản hồi từ máy chủ bị treo khi đọc dữ liệu.', 0);
      }
      const BODY_TIMED_OUT = Symbol('body_timeout');
      const result = await Promise.race([
        response.json().then(
          (json: T) => json,
          (err) => {
            throw err;
          },
        ),
        new Promise<typeof BODY_TIMED_OUT>((resolve) => {
          bodyTimer = setTimeout(() => resolve(BODY_TIMED_OUT), remainingTimeout);
        }),
      ]);
      if (result === BODY_TIMED_OUT) {
        throw new ApiError('Phản hồi từ máy chủ bị treo khi đọc dữ liệu.', 0);
      }
      return result as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Phản hồi từ máy chủ bị lỗi hoặc bị treo khi đọc dữ liệu.', 0);
  } finally {
    if (bodyTimer !== undefined) {
      clearTimeout(bodyTimer);
    }
  }
}
