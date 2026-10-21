import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { QueryError } from '@/components/query-error';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nhật ký thao tác · Sân Ngon' };
type Entry = { id: number; actor_id: string | null; actor_name: string | null; action: string; entity_id: string; entity_code: string | null; details: Record<string, unknown>; created_at: string };
type Result = { total: number; page: number; pages: number; rows: Entry[] };
const labels: Record<string, string> = {
  'booking.confirmed': 'Xác nhận đã nhận cọc', 'booking.cancelled': 'Hủy đơn', 'booking.no_show': 'Ghi nhận không đến',
  'booking.refund_recorded': 'Ghi khoản hoàn tiền', 'owner.reviewed': 'Duyệt hồ sơ chủ sân',
  'subscription.fee_changed': 'Đổi chế độ thu phí', 'subscription.period_changed': 'Cập nhật hạn phí',
  'sepay.status_changed': 'Đổi trạng thái kết nối SePay', 'notification.retry_requested': 'Yêu cầu gửi lại thông báo',
  'venue.status_changed': 'Đổi trạng thái cụm sân',
};
const states: Record<string, string> = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', completed: 'Hoàn tất', cancelled: 'Đã hủy', no_show: 'Không đến', active: 'Đang hoạt động', rejected: 'Cần bổ sung', draft: 'Bản nháp', setup: 'Đang thiết lập', ready: 'Sẵn sàng', reconnect: 'Cần kết nối lại', disconnected: 'Đã ngắt' };
function description(row: Entry) {
  if (typeof row.details.amount === 'number') return `Đã ghi hoàn ${vnd(row.details.amount)}`;
  if (typeof row.details.fee_required === 'boolean') return row.details.fee_required ? 'Bật thu phí chủ sân' : 'Miễn phí chủ sân';
  if (row.action === 'subscription.period_changed') return 'Hạn đã đóng phí được cập nhật';
  if (typeof row.details.status === 'string') return states[row.details.status] || row.details.status;
  if (typeof row.details.from === 'string' && typeof row.details.to === 'string') return `${states[row.details.from] || row.details.from} → ${states[row.details.to] || row.details.to}`;
  return row.details.channel === 'telegram' ? 'Kênh Telegram' : row.details.channel === 'email' ? 'Kênh email' : '';
}
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = z.object({ q: z.string().trim().max(100).catch(''), page: z.coerce.number().int().min(1).max(100000).catch(1) }).parse(await searchParams);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/nhat-ky');
  const permission = await db.rpc('is_admin');
  if (permission.error) throw new Error('Không kiểm tra được quyền quản trị.');
  if (!permission.data) redirect('/');
  const { data, error } = await db.rpc('get_operations_audit', { p_page: params.page, p_query: params.q });
  const result = !error && data ? data as unknown as Result : null;
  const href = (page: number) => '/admin/nhat-ky?' + new URLSearchParams({ page: String(page), q: params.q });
  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <DashboardPageHeader eyebrow="Quản trị / Vận hành" title="Nhật ký thao tác" description="Tra người thực hiện, thời điểm và thay đổi ở đơn, hoàn tiền, hồ sơ và cấu hình vận hành. Nhật ký bắt đầu từ khi bật tính năng, không dựng lịch sử cũ." />
    <form className="my-5 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4"><label className="min-w-0 flex-1 text-sm font-semibold">Mã đơn hoặc mã đối tượng<input name="q" maxLength={100} defaultValue={params.q} className="mt-1 min-h-11 w-full rounded-control border border-hairline bg-page px-3 font-normal" /></label><button className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Tra nhật ký</button>{params.q && <Link href="/admin/nhat-ky" className="min-h-11 py-3 text-sm text-pitch underline">Xóa tìm kiếm</Link>}</form>
    {result ? <><p className="mb-4 text-sm text-ink-secondary">{result.total} thao tác · Chỉ quản trị viên được xem · Không sửa hoặc xóa nhật ký</p>
      <ol className="divide-y divide-hairline rounded-card border border-hairline bg-card">{result.rows.map(row => <li key={row.id} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0"><p className="font-semibold text-pitch">{labels[row.action] || 'Thao tác vận hành'}</p><p className="mt-1 break-words text-sm">{description(row)}</p><p className="mt-2 break-all text-xs text-ink-secondary">{row.entity_code || row.entity_id}</p></div>
        <div className="min-w-0 sm:text-right"><p className="break-words text-sm font-semibold">{row.actor_id ? row.actor_name || 'Tài khoản không còn hiển thị' : 'Hệ thống / thao tác SQL'}</p><p className="mt-1 text-xs text-ink-secondary">{dayLabel(new Date(row.created_at))}/{ymd(new Date(row.created_at)).slice(0, 4)} · {hhmm(row.created_at)}</p></div>
      </li>)}</ol>
      {!result.rows.length && <p className="mt-4 rounded-card border border-hairline bg-card p-6 text-sm text-ink-secondary">Không có thao tác phù hợp. Thử mã khác hoặc xóa tìm kiếm.</p>}
      {result.pages > 1 && <nav aria-label="Phân trang nhật ký" className="mt-5 flex items-center justify-center gap-4 text-sm">{result.page > 1 && <Link href={href(result.page - 1)} className="min-h-11 py-3 text-pitch">← Trang trước</Link>}<span>{result.page}/{result.pages}</span>{result.page < result.pages && <Link href={href(result.page + 1)} className="min-h-11 py-3 text-pitch">Trang sau →</Link>}</nav>}
    </> : <QueryError className="mt-5" title="Chưa tải được nhật ký" />}
  </main>;
}
