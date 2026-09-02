import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { ReaderAccountResponse } from '../api';
import { ReaderAccountsPage } from './ReaderAccountsPage';

const createReaderAccountMock = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  createReaderAccount: createReaderAccountMock,
}));

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Email reader'), {
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
    createReaderAccountMock.mockReset();
  });

  it('submits a reader account and explains the confirmation-email state without claiming a new account', async () => {
    createReaderAccountMock.mockResolvedValue({
      id: 'reader-1',
      email: 'reader@example.com',
      app_role: 'reader',
      confirmation_required: true,
    } satisfies ReaderAccountResponse);
    render(<ReaderAccountsPage />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản reader' }));

    await waitFor(() => {
      expect(createReaderAccountMock).toHaveBeenCalledWith({
        email: 'reader@example.com',
        password: 'reader-pass',
      });
    });
    expect(await screen.findByText('Đã tiếp nhận yêu cầu cho reader@example.com.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Supabase yêu cầu xác nhận email. Reader cần kiểm tra hộp thư trước khi đăng nhập.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a loading state and prevents another submit while the request is pending', async () => {
    let resolveRequest!: (value: ReaderAccountResponse) => void;
    createReaderAccountMock.mockReturnValue(
      new Promise<ReaderAccountResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<ReaderAccountsPage />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản reader' }));

    const pendingButton = screen.getByRole('button', { name: 'Đang tạo tài khoản…' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(createReaderAccountMock).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest({
        id: 'reader-1',
        email: 'reader@example.com',
        app_role: 'reader',
        confirmation_required: false,
      });
    });
  });

  it('blocks an invalid email before calling the API', () => {
    render(<ReaderAccountsPage />);
    fireEvent.change(screen.getByLabelText('Email reader'), {
      target: { value: 'reader-at-example' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu ban đầu'), {
      target: { value: 'reader-pass' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản reader' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Email reader không đúng định dạng.');
    expect(createReaderAccountMock).not.toHaveBeenCalled();
  });

  it('localizes the server error and keeps the form available for retry', async () => {
    createReaderAccountMock.mockRejectedValue(new ApiError('Provider unavailable', 503));
    render(<ReaderAccountsPage />);
    fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản reader' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể kết nối Supabase Auth. Vui lòng thử lại sau.',
    );
    expect(screen.getByRole('button', { name: 'Tạo tài khoản reader' })).toBeEnabled();
  });

  it('blocks mismatched passwords before calling the API', () => {
    render(<ReaderAccountsPage />);
    fireEvent.change(screen.getByLabelText('Email reader'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu ban đầu'), {
      target: { value: 'reader-pass' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'different-pass' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản reader' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Hai mật khẩu chưa trùng nhau.');
    expect(createReaderAccountMock).not.toHaveBeenCalled();
  });
});
