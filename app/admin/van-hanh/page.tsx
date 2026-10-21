import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { QueryError } from '@/components/query-error';
import { ActionForm } from '@/components/action-form';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, ymd } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vận hành · Sân Ngon' };
type Delivery = { id: string; kind: string; channel: string; status: string; attempts: number; last_reason: string | null; code: string | null; full_name: string | null; created_at: string; updated_at: string };
type Result = { total: number; page: number; pages: number; failed: number; pending: number; worker_configured: boolean; worker_last_request_at: string | null; rows: Delivery[] };
const statuses: Record<string, string> = { pending: 'Đang chờ', processing: 'Đang gửi', sent: 'Đã gửi', failed: 'Gửi thất bại', skipped: 'Bỏ qua liên hệ đã đổi' };
const reasons: Record<string, string> = { NOT_CONFIGURED: 'Thiếu cấu hình kênh gửi', NETWORK: 'Mất kết nối hoặc hết thời gian', INVALID_RESPONSE: 'Chưa xác nhận được phản hồi nhà cung cấp', LEASE_EXHAUSTED: 'Hết số lần phục hồi tác vụ', RECIPIENT_CHANGED: 'Liên hệ đã đổi hoặc tài khoản bị khóa', HTTP_429: 'Nhà cung cấp giới hạn tần suất', HTTP_401: 'Khóa nhà cung cấp không hợp lệ', HTTP_403: 'Nhà cung cấp từ chối gửi' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = z.coerce.number().int().min(1).max(100000).catch(1).parse((await searchParams).page);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/van-hanh');
  const permission = await db.rpc('is_admin');
  if (permission.error) throw new Error('Không kiểm tra được quyền quản trị.');
  if (!permission.data) redirect('/');
  const { data, error } = await db.rpc('get_notification_delivery_page', { p_page: page });
  const result = !error && data ? data as unknown as Result : null;
  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <DashboardPageHeader eyebrow="Quản trị / Vận hành" title="Gửi thông báo" description="Theo dõi email và Telegram cho đơn mới, kết quả duyệt hồ sơ. Tiền và trạng thái đơn đã lưu độc lập với việc gửi tin." />
    {result ? <>
      {!result.worker_configured && <p role="status" className="mt-5 rounded-card border border-hairline bg-card p-4 text-sm leading-6 text-ink-secondary">Chưa bật lịch gửi nền. Thông báo được giữ trong hàng đợi; cần cấu hình worker trước khi có thể gửi.</p>}
      <dl className="my-6 grid grid-cols-2 gap-3"><div className="rounded-card border border-hairline bg-card p-5"><dt className="text-sm text-ink-secondary">Chờ hoặc đang gửi</dt><dd className="mt-2 font-display text-3xl font-bold text-pitch">{result.pending}</dd></div><div className="rounded-card border border-hairline bg-card p-5"><dt className="text-sm text-ink-secondary">Cần kiểm tra lỗi</dt><dd className="mt-2 font-display text-3xl font-bold text-danger">{result.failed}</dd></div></dl>
      <p className="mb-5 text-sm leading-6 text-ink-secondary">Hệ thống tự thử lại lỗi tạm thời tối đa 6 lần. Telegram có thể nhận trùng nếu nhà cung cấp đã gửi nhưng phản hồi bị mất. Kiểm tra kênh gửi trước khi yêu cầu gửi lại.</p>
      <ul className="divide-y divide-hairline rounded-card border border-hairline bg-card">{result.rows.map(row => <li key={row.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1"><p className="break-words font-semibold text-pitch">{row.kind === 'booking' ? `Đơn ${row.code || 'đặt sân'}` : 'Kết quả hồ sơ chủ sân'} · {row.channel === 'email' ? 'Email' : 'Telegram'}</p>
          <p className="mt-1 text-sm">{row.full_name || 'Người nhận'} · {statuses[row.status] || row.status} · {row.attempts} lần thử</p>
          <p className="mt-1 text-xs text-ink-secondary">{dayLabel(new Date(row.created_at))}/{ymd(new Date(row.created_at)).slice(0, 4)} · {hhmm(row.created_at)}</p>
          {row.last_reason && <p className="mt-2 break-words text-sm text-ink-secondary">{reasons[row.last_reason] || `Lỗi kênh gửi: ${row.last_reason}`}</p>}
        </div>
        {row.status === 'failed' && <ActionForm endpoint={`/api/admin/notification-deliveries/${row.id}/retry`} payload={{ updated_at: row.updated_at }} label="Đưa vào hàng đợi lại" confirmMessage="Đã kiểm tra cấu hình và kênh nhận? Thao tác yêu cầu gửi lại thông báo, không xác nhận hay chuyển thêm tiền." successMessage="Đã đưa vào hàng đợi." />}
      </li>)}</ul>
      {!result.rows.length && <p className="mt-4 rounded-card border border-hairline bg-card p-6 text-sm text-ink-secondary">Chưa có tác vụ gửi thông báo. Tác vụ mới được tạo cùng giao dịch xác nhận cọc hoặc duyệt hồ sơ.</p>}
      {result.pages > 1 && <nav aria-label="Phân trang gửi thông báo" className="mt-5 flex items-center justify-center gap-4 text-sm">{result.page > 1 && <Link href={`/admin/van-hanh?page=${result.page - 1}`} className="min-h-11 py-3 text-pitch">← Trang trước</Link>}<span>{result.page}/{result.pages}</span>{result.page < result.pages && <Link href={`/admin/van-hanh?page=${result.page + 1}`} className="min-h-11 py-3 text-pitch">Trang sau →</Link>}</nav>}
    </> : <QueryError className="mt-6" title="Chưa tải được hàng đợi thông báo" />}
  </main>;
}
