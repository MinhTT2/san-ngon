import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { QueryError } from '@/components/query-error';
import { ymd } from '@/lib/format';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rà soát lưu dữ liệu · Sân Ngon' };
type Review = { total: number; pages: number; page: number; rows: { kind: string; id: string; label: string; since: string }[] };
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = z.coerce.number().int().positive().max(100000).catch(1).parse((await searchParams).page);
  const db = await createClient(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect('/dang-nhap?next=/admin/du-lieu');
  const permission = await db.rpc('is_admin'); if (permission.error) throw new Error('Chưa kiểm tra được quyền.'); if (!permission.data) redirect('/');
  const { data, error } = await db.rpc('get_retention_review', { p_page: page }); const result = data as unknown as Review | null;
  return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8"><DashboardPageHeader eyebrow="Quản trị / Dữ liệu" title="Rà soát lưu dữ liệu" description="Giấy tờ hồ sơ bị từ chối sau 90 ngày và hỗ trợ đã kết thúc sau 180 ngày được đưa vào diện xem xét. Không tự xóa hoặc áp dụng chung cho chứng từ tài chính." />
    <Link href="/admin/gop-y?category=privacy" className="my-5 inline-flex min-h-11 items-center font-semibold text-pitch underline">Xử lý yêu cầu dữ liệu cá nhân →</Link>
    <p className="mb-5 text-sm leading-7 text-ink-secondary">Trước khi xóa, xác minh chủ dữ liệu, kiểm tra yêu cầu đang mở, đơn/giải/hoàn tiền/tranh chấp và bản sao backup. Giấy tờ tài khoản đang hoạt động, hỗ trợ có liên kết đơn hoặc chứng từ không vào danh sách này. Yêu cầu xóa cần trả lời rõ phần đã xử lý và phần phải giữ; việc xóa tệp và dữ liệu liên quan do người vận hành thực hiện có kiểm soát.</p>
    {error || !result ? <QueryError title="Chưa tải được danh sách rà soát" /> : <><p className="mb-4 text-sm">{result.total} mục đến mốc xem xét</p><ul className="divide-y divide-hairline rounded-card border border-hairline bg-card">{result.rows.map(row => <li key={row.kind + row.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="break-words font-semibold text-pitch">{row.label || 'Hồ sơ chủ sân'}</p><p className="mt-2 text-xs text-ink-secondary">{row.kind === 'owner_document' ? 'Giấy tờ hồ sơ bị từ chối' : 'Hỗ trợ đã kết thúc'} · từ {ymd(new Date(row.since))}</p></div><Link href={row.kind === 'owner_document' ? `/admin/owners/${row.id}` : `/admin/gop-y/${row.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Mở để rà soát</Link></li>)}</ul>{!result.rows.length && <p className="mt-4 text-sm text-ink-secondary">Chưa có mục đến mốc xem xét.</p>}{result.pages > 1 && <nav aria-label="Phân trang rà soát dữ liệu" className="mt-5 flex justify-center gap-4 text-sm">{result.page > 1 && <Link href={`?page=${result.page - 1}`} className="min-h-11 py-3">← Trang trước</Link>}<span className="py-3">{result.page}/{result.pages}</span>{result.page < result.pages && <Link href={`?page=${result.page + 1}`} className="min-h-11 py-3">Trang sau →</Link>}</nav>}</>}
  </main>;
}
