import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteMotion } from '@/components/site-motion';
import './globals.css';

export const metadata: Metadata = {
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
