import { SiteHeader } from '@/components/site-header';
import { DashboardSidebar } from '@/components/dashboard-sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-sunk">
      <SiteHeader variant="admin" />
      <div className="flex flex-grow flex-col lg:flex-row">
        <DashboardSidebar role="admin" />
        <div id="noi-dung" tabIndex={-1} className="min-w-0 flex-grow">{children}</div>
      </div>
    </div>
  );
}
