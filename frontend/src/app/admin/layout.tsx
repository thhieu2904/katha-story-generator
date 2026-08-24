import { AdminHeader } from '@/components/layout/AdminHeader';
import { RequireAdmin } from '@/features/auth/RequireAdmin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <div className="katha-page-shell min-h-screen bg-katha-surface">
        <AdminHeader />
        {children}
      </div>
    </RequireAdmin>
  );
}
