import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGa4Report, getGa4Realtime } from '@/lib/ga4-report';
import { TrafficReport, RealtimePanel } from '@/components/traffic-report';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { PeriodLinks } from '@/components/stats-panels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thống kê truy cập · Sân Ngon' };

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/thong-ke-truy-cap');
  const { data: admin, error } = await db.rpc('is_admin');
  if (error) throw new Error('Chưa kiểm tra được quyền quản trị.');
  if (!admin) redirect('/');
  const { period } = await searchParams;
  const days = period === '7' ? 7 : period === '90' ? 90 : 30;
  const [result, realtime] = await Promise.all([getGa4Report(days), getGa4Realtime()]);
  return <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Quản trị / Website" title="Thống kê truy cập" description="Dữ liệu Google Analytics 4 của các trang công khai. Số người truy cập có thể bao gồm khách chưa đăng nhập." />
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-pitch">{days} ngày gần nhất, gồm hôm nay</p><PeriodLinks path="/admin/thong-ke-truy-cap" period={days} /></div>
    <RealtimePanel result={realtime} days={days} />
    {result.status === 'ready' ? <TrafficReport report={result.report} days={days} /> : <section className="mt-5 rounded-card border border-hairline bg-card p-6" role="status">
      <h2 className="font-display text-xl font-bold text-pitch">{result.status === 'not_configured' ? 'Chưa kết nối báo cáo Google Analytics' : 'Chưa tải được báo cáo truy cập'}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-secondary">{{
        not_configured: 'Website đã gửi lượt xem đến GA4. Để đọc báo cáo tại đây, cần thêm Property ID và tài khoản dịch vụ có quyền Người xem vào cấu hình server. Chưa kết nối không có nghĩa là website có 0 lượt truy cập.',
        permission: 'Google chưa cho phép đọc property này. Kiểm tra quyền Người xem của tài khoản dịch vụ, Property ID và việc bật Google Analytics Data API.',
        quota: 'Google đang giới hạn lượt đọc báo cáo. Vui lòng quay lại sau ít phút.',
        unavailable: 'Dịch vụ báo cáo tạm thời không phản hồi hoặc cấu hình kết nối chưa hợp lệ. Vui lòng thử lại sau.',
      }[result.status]}</p>
      <Link href={`/admin/thong-ke-truy-cap?period=${days}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-pitch underline underline-offset-4">Tải lại trang</Link>
    </section>}
    <p className="mt-5 text-xs leading-6 text-ink-secondary">GA4 cập nhật có độ trễ và có thể thiếu người chặn theo dõi. Thời gian tương tác là lúc website ở phía trước thiết bị, không phải tổng thời gian của từng tài khoản. Xem thời lượng tài khoản tại <Link href="/admin/users" className="font-semibold text-pitch underline">Người dùng</Link>. Các số này không dùng để đối soát doanh thu.</p>
  </main>;
}
