import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/**
 * Bọc mọi trang trừ /dat-san/[code]. Trang thanh toán cố ý không có nav:
 * bớt đường thoát khỏi luồng trả tiền càng tốt.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex-grow">{children}</div>
      <SiteFooter />
    </div>
  );
}
