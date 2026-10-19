import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGa4Report, type TrafficReport } from '@/lib/ga4-report';
import { usageDuration } from '@/lib/usage-duration';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { PeriodLinks } from '@/components/stats-panels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Thống kê truy cập · Sân Ngon' };
const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/thong-ke-truy-cap');
  const { data: admin, error } = await db.rpc('is_admin');
  if (error) throw new Error('Chưa kiểm tra được quyền quản trị.');
  if (!admin) redirect('/');
  const { period } = await searchParams;
  const days = period === '7' ? 7 : period === '90' ? 90 : 30;
  const result = await getGa4Report(days);
  return <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Quản trị / Website" title="Thống kê truy cập" description="Dữ liệu Google Analytics 4 của các trang công khai. Số người truy cập có thể bao gồm khách chưa đăng nhập." />
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-pitch">{days} ngày gần nhất, gồm hôm nay</p><PeriodLinks path="/admin/thong-ke-truy-cap" period={days} /></div>
    {result.status === 'ready' ? <Report report={result.report} /> : <section className="mt-5 rounded-card border border-hairline bg-card p-6" role="status">
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

function Report({ report }: { report: TrafficReport }) {
  const { summary } = report;
  const maximum = Math.max(1, ...report.daily.map(day => day.views));
  const devices: Record<string, string> = { desktop: 'Máy tính', mobile: 'Điện thoại', tablet: 'Máy tính bảng' };
  return <>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Người dùng hoạt động', number(summary.users)], ['Lượt xem trang', number(summary.views)],
      ['Phiên truy cập', number(summary.sessions)], ['Tương tác trung bình / người', usageDuration(summary.average_seconds)],
    ].map(([label, value]) => <section key={label} className="rounded-card border border-hairline bg-card p-5"><p className="text-xs text-ink-secondary">{label}</p><p className="mt-3 font-display text-2xl font-bold tabular-nums text-pitch">{value}</p></section>)}</div>
    <section className="mt-6 rounded-card border border-hairline bg-card p-5"><h2 className="font-display text-xl font-bold text-pitch">Lượt xem theo ngày</h2>
      {report.daily.length ? <div className="mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-2">{report.daily.map(day => <div key={day.date} className="grid grid-cols-[3rem_minmax(0,1fr)_4rem] items-center gap-3 text-xs"><span className="text-ink-secondary">{day.date.slice(6, 8)}/{day.date.slice(4, 6)}</span><div className="h-3 overflow-hidden rounded-pill bg-sunk"><div className="h-full rounded-pill bg-pitch" style={{ width: `${day.views / maximum * 100}%` }} /></div><span className="text-right tabular-nums" aria-label={`${day.date}: ${day.views} lượt xem`}>{number(day.views)}</span></div>)}</div> : <p className="mt-4 text-sm text-ink-secondary">GA4 chưa trả về lượt xem trong khoảng này.</p>}
    </section>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2"><Breakdown title="Nguồn truy cập" unit="phiên" rows={report.channels.map(row => ({ name: row.name, value: row.sessions }))} /><Breakdown title="Thiết bị" unit="người" rows={report.devices.map(row => ({ name: devices[row.name] ?? 'Khác', value: row.users }))} /></div>
    <section className="mt-6 rounded-card border border-hairline bg-card p-5"><h2 className="font-display text-xl font-bold text-pitch">Trang được xem nhiều</h2><div className="mt-4 divide-y divide-hairline">{report.pages.length ? report.pages.map(row => <div key={row.path} className="flex min-w-0 items-center justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="font-semibold text-pitch">{row.title}</p><p className="mt-1 break-all text-xs text-ink-secondary">{row.path}</p></div><span className="shrink-0 tabular-nums">{number(row.views)} lượt</span></div>) : <p className="text-sm text-ink-secondary">Chưa có dữ liệu trang công khai.</p>}</div></section>
    <p className="mt-4 text-xs leading-6 text-ink-secondary">Lấy dữ liệu lúc {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(report.fetched_at))}. Làm mới tối đa mỗi 10 phút. Múi giờ property: {report.time_zone || 'theo cấu hình GA4'}.</p>
  </>;
}

function Breakdown({ title, unit, rows }: { title: string; unit: string; rows: { name: string; value: number }[] }) {
  return <section className="rounded-card border border-hairline bg-card p-5"><h2 className="font-display text-xl font-bold text-pitch">{title}</h2><div className="mt-4 divide-y divide-hairline">{rows.length ? rows.map(row => <div key={row.name} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="min-w-0 break-words">{row.name}</span><span className="shrink-0 tabular-nums">{number(row.value)} {unit}</span></div>) : <p className="text-sm text-ink-secondary">Chưa có dữ liệu.</p>}</div></section>;
}
