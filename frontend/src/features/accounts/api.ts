import { ApiError, apiFetch } from '@/lib/api';

export interface CreateReaderAccountInput {
  email: string;
  password: string;
}

export interface ReaderAccountResponse {
  id: string;
  email: string;
  app_role: 'reader';
  confirmation_required: boolean;
}

export function createReaderAccount(input: CreateReaderAccountInput) {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new ApiError('Supabase Auth chưa được cấu hình cho ứng dụng.', 0);
  }

  return apiFetch<ReaderAccountResponse>('/api/auth/readers', {
    method: 'POST',
    headers: {
      'X-Supabase-Publishable-Key': publishableKey,
    },
    body: JSON.stringify(input),
  });
}
