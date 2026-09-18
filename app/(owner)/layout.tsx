import { SiteHeader } from '@/components/site-header';

/**
 * Khu chủ sân có shell riêng: không dùng footer và nav của trang đặt sân.
 * Nội dung quản lý cần giữ người dùng trong luồng vận hành sân.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-sunk">
      <SiteHeader variant="dashboard" />
      <div className="flex-grow">{children}</div>
    </div>
  );
}
