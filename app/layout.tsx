import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteMotion } from '@/components/site-motion';
import { siteUrl } from '@/lib/site-url';
import { DEFAULT_SHARE_IMAGE } from '@/lib/public-metadata';
import { GoogleAnalytics } from '@/components/google-analytics';
import { productionAnalyticsId } from '@/lib/analytics';
import { UserActivityTracker } from '@/components/user-activity-tracker';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  openGraph: { siteName: 'Sân Ngon', locale: 'vi_VN', type: 'website', images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', images: [DEFAULT_SHARE_IMAGE] },
  title: 'Sân Ngon — Đặt sân thể thao ở Hà Nội',
  description: 'Xem lịch trống, chốt sân, trả cọc. Khỏi gọi điện.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const analyticsId = productionAnalyticsId(process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  return (
    <html lang="vi">
      <body className="min-h-dvh"><Suspense fallback={null}><SiteMotion /></Suspense>{children}
        {analyticsId && <Suspense fallback={null}><GoogleAnalytics measurementId={analyticsId} /></Suspense>}
        {process.env.VERCEL_ENV === 'production' && <UserActivityTracker />}
      </body>
    </html>
  );
}
