import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sân Ngon — Đặt sân thể thao ở Hà Nội',
  description: 'Xem lịch trống, chốt sân, trả cọc. Khỏi gọi điện.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
