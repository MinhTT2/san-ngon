import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DashboardPageHeader } from './dashboard-page-header';
import { QueryError } from './query-error';
import { cashSources, type CashReport as Result } from '@/lib/cash-report';
import { vnd, hhmm, ymd } from '@/lib/format';
const field = 'mt-1 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal';
export async function CashReport({ searchParams, admin = false }: { searchParams: Promise<Record<string, string | string[] | undefined>>; admin?: boolean }) {
  const path = admin ? '/admin/bao-cao-tien' : '/chu-san/bao-cao-tien';
  const params = z.object({ from: z.string().date().optional().catch(undefined), to: z.string().date().optional().catch(undefined), page: z.coerce.number().int().positive().max(100000).catch(1) }).parse(await searchParams);
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=' + path);
  if (admin) { const permission = await db.rpc('is_admin'); if (permission.error) throw new Error('Chưa kiểm tra được quyền.'); if (!permission.data) redirect('/'); }
  const { data, error } = await db.rpc('get_cash_report', { p_from: params.from, p_to: params.to, p_page: params.page });
  const report = data as unknown as Result | null;
  const href = (page: number) => path + '?' + new URLSearchParams({ from: report!.from, to: report!.to, page: String(page) });
  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <DashboardPageHeader eyebrow={`${admin ? 'Quản trị' : 'Chủ sân'} / Báo cáo`} title="Tiền ghi nhận trên website" description="Khoản nhận đã xác định được mã và đúng người nhận, tách đặt sân, giải đấu và phí. Đối chiếu với sao kê trước khi kết luận số tiền thực tế." />
    <form className="my-5 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4">
      <label className="w-full min-w-0 text-sm font-semibold sm:w-auto sm:min-w-44 sm:flex-1">Từ ngày<input name="from" type="date" defaultValue={params.from || report?.from} required className={field} /></label>
      <label className="w-full min-w-0 text-sm font-semibold sm:w-auto sm:min-w-44 sm:flex-1">Đến hết ngày<input name="to" type="date" defaultValue={params.to || report?.to} required className={field} /></label>
      <button className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Xem báo cáo</button>
    </form>
    {error || !report ? <QueryError title={error?.message === 'INVALID_DATE_RANGE' ? 'Chọn khoảng ngày không quá 93 ngày.' : 'Chưa tải được báo cáo tiền'} /> : <>
      <dl className="grid gap-3 sm:grid-cols-2"><div className="rounded-card border border-hairline bg-card p-5"><dt className="text-sm text-ink-secondary">Nhận vào đã nhận diện trong kỳ</dt><dd className="mt-2 font-display text-2xl font-bold text-pitch">{vnd(report.received)}</dd></div><div className="rounded-card border border-hairline bg-card p-5"><dt className="text-sm text-ink-secondary">Hoàn sân có chứng từ trong kỳ</dt><dd className="mt-2 font-display text-2xl font-bold text-pitch">{vnd(report.refunded)}</dd></div></dl>
      <ul className="my-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">{report.sources.map(source => <li key={source.source}>{cashSources[source.source]}: <strong>{vnd(source.received)}</strong></li>)}</ul>
      <p className="text-sm leading-6 text-ink-secondary">{report.review_count} khoản nhận trong kỳ cần đối soát. Tiền nhận theo lúc website ghi nhận, tiền hoàn theo giờ chuyển đã khai, múi giờ Việt Nam. Xác nhận tay không tạo thêm khoản ngân hàng; tổng này không phải doanh thu hay số dư tài khoản.</p>
      <div className="my-5 rounded-card border border-hairline bg-card p-5"><h2 className="font-semibold text-pitch">Nghĩa vụ hoàn sân hiện tại</h2><p className="mt-2 text-lg font-semibold">{vnd(report.booking_refund_due_now)}</p><p className="mt-2 text-sm leading-6 text-ink-secondary">Số còn phải hoàn của tất cả đơn cần hoàn tại lúc tải trang, gồm căn cứ xác nhận tay; không giới hạn theo kỳ đang lọc. {report.legacy_refund_count} đơn hoàn theo cách cũ chưa có đủ chứng từ, cần đối soát riêng. Hoàn giải và quyết toán giải xem trong từng giải.</p></div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{report.total} khoản nhận/hoàn</p><a href={'/api/cash-report?' + new URLSearchParams({ from: report.from, to: report.to })} className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Tải CSV khoản nhận/hoàn</a></div>
      <ol className="divide-y divide-hairline rounded-card border border-hairline bg-card">{report.rows.map(row => <li key={row.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><p className="break-all font-semibold text-pitch">{row.code} · {cashSources[row.source]}</p><p className="mt-1 break-all text-xs text-ink-secondary">{ymd(new Date(row.occurred_at))} {hhmm(row.occurred_at)} · {row.reference}</p>{row.needs_review && <p className="mt-1 text-xs text-danger">Cần đối soát</p>}</div><p className="font-semibold">{row.refunded ? 'Hoàn sân ' + vnd(row.refunded) : 'Nhận ' + vnd(row.received)}</p></li>)}</ol>
      {!report.rows.length && <p className="my-4 text-sm text-ink-secondary">Chưa có khoản nhận/hoàn được ghi nhận trong kỳ.</p>}
      {report.pages > 1 && <nav aria-label="Phân trang báo cáo tiền" className="mt-5 flex justify-center gap-4 text-sm">{report.page > 1 && <Link href={href(report.page - 1)} className="min-h-11 py-3 text-pitch">← Trang trước</Link>}<span className="py-3">{report.page}/{report.pages}</span>{report.page < report.pages && <Link href={href(report.page + 1)} className="min-h-11 py-3 text-pitch">Trang sau →</Link>}</nav>}
      <p className="mt-4 text-xs leading-6 text-ink-secondary">CSV tối đa 5.000 dòng mỗi lần; không cắt dữ liệu khi vượt giới hạn. File có mã giao dịch, chỉ chia sẻ với người phụ trách đối soát.</p>
    </>}
  </main>;
}
