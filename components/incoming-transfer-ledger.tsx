import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import { TRANSFER_OUTCOMES, type IncomingTransferPage } from '@/lib/incoming-transfers';
import { DashboardPageHeader } from './dashboard-page-header';
import { QueryError } from './query-error';
import { LivePageRefresh } from './live-page-refresh';
import { IncomingTransferNote } from './incoming-transfer-note';
const schema = z.object({ q: z.string().trim().max(100).catch(''), filter: z.enum(['all', 'review', 'exact']).catch('review'), page: z.coerce.number().int().min(1).max(100000).catch(1) });
export async function IncomingTransferLedger({ role, searchParams }: { role: 'owner' | 'admin'; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const path = role === 'admin' ? '/admin/tien-vao' : '/chu-san/tien-vao';
  const params = schema.parse(await searchParams), db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=' + path);
  const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profileError) throw new Error('Chưa kiểm tra được quyền truy cập.');
  if (role === 'admin' ? profile?.role !== 'admin' : !['admin', 'owner'].includes(profile?.role ?? '')) redirect('/');
  const { data, error } = await db.rpc('get_incoming_transfer_page', { p_query: params.q, p_filter: params.filter, p_page: params.page });
  const result = !error && data ? data as unknown as IncomingTransferPage : null;
  const href = (page: number, filter = params.filter, q = params.q) => path + '?' + new URLSearchParams({ q, filter, page: String(page) });
  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    {role === 'owner' && <LivePageRefresh scope="owner" />}
    <DashboardPageHeader eyebrow={role === 'admin' ? 'Quản trị / Đối soát' : 'Chủ sân / Đối soát'} title="Sổ tiền vào" description={role === 'admin' ? 'Giao dịch ghi nhận từ các tài khoản nhận tiền của hệ thống.' : 'Giao dịch ghi nhận từ tài khoản nhận tiền của bạn, gồm cả khoản chưa khớp mã.'} />
    <p className="mt-4 rounded-card border border-hairline bg-card p-4 text-sm leading-6 text-ink-secondary">Số tiền thực nhận gồm cả tiền thiếu, thừa và chuyển thêm; chưa trừ khoản hoàn, chưa phải doanh thu. Giao dịch không có mã hoặc có nhiều mã cần kiểm tra thủ công. Sổ cũ chỉ có những giao dịch hệ thống đã từng lưu; ghi chú không tự gán tiền vào đơn.</p>
    {result && <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-card border border-hairline bg-card p-5"><p className="text-sm text-ink-secondary">Thực nhận được ghi nhận · toàn bộ sổ</p><p className="mt-2 break-words font-display text-2xl font-bold text-pitch">{vnd(result.received_amount)}</p></div><div className="rounded-card border border-hairline bg-card p-5"><p className="text-sm text-ink-secondary">Giao dịch cần đối soát</p><p className="mt-2 font-display text-2xl font-bold text-pitch">{result.review_count}</p></div></div>}
    <form className="mt-5 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4"><input type="hidden" name="filter" value={params.filter} /><label className="min-w-0 flex-1 text-sm font-semibold">Mã đặt sân, mã giải, mã phí hoặc mã giao dịch<input name="q" maxLength={100} defaultValue={params.q} className="mt-2 h-11 w-full rounded-control border border-hairline bg-page px-3 font-normal" /></label><button className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Tìm giao dịch</button>{params.q && <Link href={href(1, params.filter, '')} className="inline-flex min-h-11 items-center text-sm text-pitch underline">Xóa tìm kiếm</Link>}</form>
    <nav aria-label="Lọc tiền vào" className="mt-5 flex flex-wrap gap-2">{(['review', 'exact', 'all'] as const).map(filter => <Link key={filter} href={href(1, filter)} aria-current={filter === params.filter ? 'page' : undefined} className={'inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-semibold ' + (filter === params.filter ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card text-pitch')}>{filter === 'review' ? 'Cần đối soát' : filter === 'exact' ? 'Đã khớp' : 'Tất cả'}</Link>)}</nav>
    {result ? <><p className="mt-4 text-sm text-ink-secondary">{result.total} giao dịch phù hợp · 30 giao dịch mỗi trang</p><ul className="mt-4 space-y-3">{result.rows.map(row => <li key={row.id} className="min-w-0 rounded-card border border-hairline bg-card p-5">
      <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold text-pitch">{row.ref_codes.length ? row.ref_codes.join(' · ') : 'Chưa có mã trong nội dung'}</h2><p className="mt-1 text-sm text-ink-secondary">{dayLabel(new Date(row.created_at))}/{ymd(new Date(row.created_at)).slice(0, 4)} · {hhmm(row.created_at)}</p></div><p className="text-sm font-semibold">{TRANSFER_OUTCOMES[row.outcome] ?? 'Cần kiểm tra'}{row.needs_review ? ' · cần đối soát' : ''}</p></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-ink-secondary">Thực nhận giao dịch này</dt><dd className="mt-1 text-lg font-semibold text-pitch">{vnd(row.amount)}</dd></div><div><dt className="text-ink-secondary">Cọc / phí theo mã</dt><dd className="mt-1 font-semibold">{row.expected_amount === null ? 'Chưa xác định' : vnd(row.expected_amount)}</dd></div><div className="min-w-0"><dt className="text-ink-secondary">Tài khoản nhận</dt><dd className="mt-1 break-all">{row.bank} · {row.account_number}</dd></div><div className="min-w-0"><dt className="text-ink-secondary">Mã giao dịch ngân hàng</dt><dd className="mt-1 break-all">{row.bank_tx_id}</dd></div></dl>
      {row.booking_received !== null && <p className="mt-3 text-sm text-ink-secondary">Tổng tiền vào đã gắn mã đơn: {vnd(row.booking_received)}. Các khoản thiếu không được cộng dồn để tự xác nhận cọc.</p>}
      {row.payload_conflicts > 0 && <p className="mt-3 text-sm font-semibold text-danger">Có thông tin gửi lại khác giao dịch gốc. Số tiền và mã gốc được giữ nguyên; cần kiểm tra trên ngân hàng.</p>}
      {!!row.notes.length && <ul aria-label="Ghi chú đã lưu" className="mt-4 space-y-2 border-t border-hairline pt-3">{row.notes.map((note, index) => <li key={index} className="text-sm"><p className="whitespace-pre-wrap break-words">{note.note}</p><p className="mt-1 text-xs text-ink-secondary">{dayLabel(new Date(note.created_at))} · {hhmm(note.created_at)}</p></li>)}</ul>}
      <IncomingTransferNote id={row.id} updatedAt={row.updated_at} />
    </li>)}</ul>{!result.rows.length && <p className="mt-5 rounded-card border border-hairline bg-card p-8 text-center text-sm text-ink-secondary">Chưa có giao dịch phù hợp. Thử đổi bộ lọc hoặc từ khóa.</p>}
    {result.pages > 1 && <nav aria-label="Phân trang tiền vào" className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm">{result.page > 1 && <Link href={href(result.page - 1)} className="inline-flex min-h-11 items-center text-pitch">← Trang trước</Link>}<span>{result.page}/{result.pages}</span>{result.page < result.pages && <Link href={href(result.page + 1)} className="inline-flex min-h-11 items-center text-pitch">Trang sau →</Link>}</nav>}</> : <QueryError className="mt-5" title="Chưa tải được sổ tiền vào" />}
  </main>;
}
