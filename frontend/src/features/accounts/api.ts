import { apiFetch } from '@/lib/api';

export type AccountRole = 'admin' | 'reader';

export interface CreateAccountInput {
  display_name: string;
  email: string;
  password: string;
  app_role: AccountRole;
}

export interface Account {
  id: string;
  display_name: string | null;
  email: string | null;
  app_role: AccountRole;
  created_at: string | null;
  last_sign_in_at: string | null;
}

export function createAccount(input: CreateAccountInput) {
  return apiFetch<Account>('/api/auth/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listAccounts(signal?: AbortSignal) {
  const response = await apiFetch<{ accounts: Account[] }>('/api/auth/accounts', {
    signal,
  });
  return response.accounts;
}

export function deleteAccount(accountId: string) {
  return apiFetch<void>(`/api/auth/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
}
