import { SiteHeader } from '@/components/site-header';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { SubscriptionBanner } from '@/components/subscription-banner';
import { OwnerBookingRefresh } from '@/components/owner-booking-refresh';

/**
 * Khu chủ sân có shell riêng: không dùng footer và nav của trang đặt sân.
 * Nội dung quản lý cần giữ người dùng trong luồng vận hành sân.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-sunk">
      <OwnerBookingRefresh />
      <SiteHeader variant="dashboard" />
      <div className="flex flex-grow flex-col lg:flex-row">
        <DashboardSidebar role="owner" />
        <div className="min-w-0 flex-grow"><SubscriptionBanner />{children}</div>
      </div>
    </div>
  );
}
