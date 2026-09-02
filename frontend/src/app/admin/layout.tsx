import { AdminHeader } from '@/components/layout/AdminHeader';
import { RequireAuth } from '@/features/auth/RequireAuth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="katha-page-shell min-h-screen bg-katha-surface">
        <AdminHeader />
        {children}
      </div>
    </RequireAuth>
  );
}
