import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  if (requestOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const timeoutSignal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
  const signal = callerSignal && timeoutSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : callerSignal || timeoutSignal;

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
  return (await response.json()) as T;
}
