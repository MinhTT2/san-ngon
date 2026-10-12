import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteMotion } from '@/components/site-motion';
import { siteUrl } from '@/lib/site-url';
import { DEFAULT_SHARE_IMAGE } from '@/lib/public-metadata';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  openGraph: { siteName: 'Sân Ngon', locale: 'vi_VN', type: 'website', images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', images: [DEFAULT_SHARE_IMAGE] },
  title: 'Sân Ngon — Đặt sân thể thao ở Hà Nội',
  description: 'Xem lịch trống, chốt sân, trả cọc. Khỏi gọi điện.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh"><Suspense fallback={null}><SiteMotion /></Suspense>{children}</body>
    </html>
  );
}
