import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { Account } from '../api';
import { ReaderAccountsPage } from './ReaderAccountsPage';

const accountApi = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../api', () => ({
  createAccount: accountApi.create,
  listAccounts: accountApi.list,
  deleteAccount: accountApi.delete,
}));

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'current-admin@example.com',
      app_role: 'admin',
    },
  }),
}));

const READER: Account = {
  id: '00000000-0000-0000-0000-000000000002',
  display_name: 'Sok Dara',
  email: 'reader@example.com',
  app_role: 'reader',
  created_at: '2026-09-02T10:00:00Z',
  last_sign_in_at: null,
};

const ADMIN: Account = {
  id: '00000000-0000-0000-0000-000000000003',
  display_name: 'Admin Two',
  email: 'admin-two@example.com',
  app_role: 'admin',
  created_at: '2026-09-03T10:00:00Z',
  last_sign_in_at: null,
};

const CURRENT_ADMIN: Account = {
  id: '00000000-0000-0000-0000-000000000001',
  display_name: 'Current Admin',
  email: 'current-admin@example.com',
  app_role: 'admin',
  created_at: '2026-09-01T10:00:00Z',
  last_sign_in_at: '2026-09-03T10:00:00Z',
};

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
    target: { value: 'Sok Dara' },
  });
  fireEvent.change(screen.getByLabelText('Email tài khoản'), {
    target: { value: 'reader@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu ban đầu'), {
    target: { value: 'reader-pass' },
  });
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
    target: { value: 'reader-pass' },
  });
}

describe('ReaderAccountsPage', () => {
  beforeEach(() => {
    accountApi.create.mockReset();
    accountApi.list.mockReset().mockResolvedValue([]);
    accountApi.delete.mockReset();
  });

  it('creates a named admin with the selected role and adds it to the list', async () => {
    accountApi.create.mockResolvedValue(ADMIN);
    render(<ReaderAccountsPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(accountApi.create).toHaveBeenCalledWith({
        display_name: 'Sok Dara',
        email: 'reader@example.com',
        password: 'reader-pass',
        app_role: 'admin',
      });
    });
    expect(await screen.findByText('Đã tạo tài khoản Admin Two (admin-two@example.com).')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản có thể đăng nhập ngay.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Danh sách tài khoản' })).toHaveTextContent('Admin Two');
  });

  it('shows a loading state and prevents another create while pending', async () => {
    let resolveRequest!: (value: Account) => void;
    accountApi.create.mockReturnValue(
      new Promise<Account>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<ReaderAccountsPage />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    const pendingButton = screen.getByRole('button', { name: 'Đang tạo tài khoản…' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(accountApi.create).toHaveBeenCalledOnce();

    await act(async () => resolveRequest(READER));
  });

  it('validates the display name before calling the API', () => {
    render(<ReaderAccountsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập tên hiển thị.');
    expect(accountApi.create).not.toHaveBeenCalled();
  });

  it('loads accounts and requires confirmation before deleting one', async () => {
    accountApi.list.mockResolvedValue([READER]);
    accountApi.delete.mockResolvedValue(undefined);
    render(<ReaderAccountsPage />);

    expect(await screen.findByText('Sok Dara')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa reader@example.com' }));

    const dialog = screen.getByRole('dialog', { name: 'Xóa tài khoản?' });
    expect(dialog).toHaveTextContent(
      'Tài khoản Reader Sok Dara (reader@example.com) sẽ bị xóa khỏi Supabase Auth',
    );
    expect(accountApi.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }));

    await waitFor(() => expect(accountApi.delete).toHaveBeenCalledWith(READER.id));
    expect(await screen.findByText('Đã xóa tài khoản reader@example.com.')).toBeInTheDocument();
    expect(screen.queryByText('Sok Dara')).not.toBeInTheDocument();
  });

  it('shows admins and disables deleting the currently signed-in admin', async () => {
    accountApi.list.mockResolvedValue([CURRENT_ADMIN, ADMIN]);
    render(<ReaderAccountsPage />);

    expect(await screen.findByText('Current Admin')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản hiện tại')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Không thể xóa tài khoản admin đang đăng nhập.' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xóa admin-two@example.com' })).toBeEnabled();
  });

  it('shows the server-only secret configuration state and allows retry', async () => {
    accountApi.list.mockRejectedValue(
      new ApiError('Supabase Admin API is not configured', 503),
    );
    render(<ReaderAccountsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Backend chưa được cấu hình SUPABASE_SECRET_KEY.',
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });

  it('keeps the form available after a Supabase error', async () => {
    accountApi.create.mockRejectedValue(new ApiError('Provider unavailable', 503));
    render(<ReaderAccountsPage />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể kết nối Supabase Auth. Vui lòng thử lại sau.',
    );
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeEnabled();
  });
});
