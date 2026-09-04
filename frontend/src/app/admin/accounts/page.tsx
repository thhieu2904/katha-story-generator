import type { Metadata } from 'next';
import { RequireAdmin } from '@/features/auth/RequireAdmin';
import { ReaderAccountsPage } from '@/features/accounts/components/ReaderAccountsPage';

export const metadata: Metadata = {
  title: 'Quản lý tài khoản',
  description: 'Trang quản trị tài khoản reader và admin của Katha.',
};

export default function AccountsPage() {
  return (
    <RequireAdmin>
      <ReaderAccountsPage />
    </RequireAdmin>
  );
}
