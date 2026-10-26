import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import { VIP_STATUS, type VipPurchase } from '@/lib/vip';
import { VipReviewForm } from '@/components/vip-actions';
import { DashboardPageHeader } from '@/components/dashboard-page-header';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Duyệt mua VIP · Sân Ngon' };
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/vip');
  const { data: admin } = await db.rpc('is_admin');
  if (!admin) redirect('/');
  const params = await searchParams;
  const status = params.status === 'history' || params.status === 'approved' ? params.status : 'pending';
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1') || 1));
  const { data, count, error } = await db.from('vip_purchases').select('*,profiles(full_name,phone)', { count: 'exact' })
    .in('status', status === 'pending' ? ['pending'] : status === 'approved' ? ['approved'] : ['approved', 'rejected'])
    .order(status === 'pending' ? 'submitted_at' : 'reviewed_at', { ascending: status === 'pending' }).order('id').range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error('Chưa tải được yêu cầu mua VIP. Vui lòng thử lại.');
  const rows = data as (VipPurchase & { reviewed_at: string | null; period_start: string | null; profiles: { full_name: string | null; phone: string | null } | null })[];
  const href = (p: number) => `/admin/vip?status=${status}&page=${p}`;
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><DashboardPageHeader eyebrow="Quản trị / VIP" title="Duyệt mua VIP" description="49.000đ / tháng · kiểm tra tiền vào và duyệt trong 30 phút. Chỉ duyệt khi đủ tiền, đúng người nhận và mã VIP." />
    <nav aria-label="Lọc yêu cầu VIP" className="mt-6 flex flex-wrap gap-3">{[
      { value: 'pending', label: 'Chờ duyệt', href: '/admin/vip' },
      { value: 'approved', label: 'Đã mua VIP', href: '/admin/vip?status=approved' },
      { value: 'history', label: 'Đã xử lý', href: '/admin/vip?status=history' },
    ].map(tab => <Link key={tab.value} href={tab.href} aria-current={status === tab.value ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-semibold ${status === tab.value ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline text-pitch'}`}>{tab.label}</Link>)}</nav>
    <p className="mt-4 text-sm text-ink-secondary">{count ?? 0} {status === 'approved' ? 'lượt mua / gia hạn đã duyệt' : 'yêu cầu'} · Người nhận: NGUYEN DANG NGUYEN · MBBank · 0691920022005</p>
    {status === 'approved' && <p className="mt-2 text-sm text-ink-secondary">Gồm cả các kỳ VIP đã hết hạn. Mỗi lần mua hoặc gia hạn là một dòng riêng.</p>}
    {!rows.length && <p className="mt-6 rounded-card border border-hairline bg-card p-8 text-sm text-ink-secondary">{status === 'approved' ? 'Chưa có lượt mua VIP được duyệt.' : 'Không có yêu cầu trong mục này.'}</p>}
    <div className="mt-6 space-y-5">{rows.map(p => <article key={p.id} className="rounded-card border border-hairline bg-card p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="break-all font-display text-xl font-bold text-pitch">{p.code}</h2><p className="mt-2 text-sm">{p.profiles?.full_name ?? 'Chưa có tên'} · {p.profiles?.phone ?? 'Chưa có số điện thoại'}</p></div><p className="text-sm font-semibold text-pitch">{VIP_STATUS[p.status]} · {vnd(p.amount)}</p></div><p className="mt-3 text-xs leading-6 text-ink-secondary">Người nhận trên yêu cầu: {p.bank} · {p.account_number} · {p.account_name}</p>
      {p.review_due_at && <p className="mt-2 text-sm text-ink-secondary">Hạn xử lý: {hhmm(p.review_due_at)} · {dayLabel(new Date(p.review_due_at))}</p>}
      {p.rejection_reason && <p className="mt-3 text-sm text-danger">{p.rejection_reason}</p>}
      {p.reviewed_at && <p className="mt-3 text-sm text-ink-secondary">Ngày xử lý: {ymd(new Date(p.reviewed_at))} · {hhmm(p.reviewed_at)}</p>}
      {p.period_end && <p className="mt-3 text-sm text-ink-secondary">Kỳ VIP: {p.period_start && <>{ymd(new Date(p.period_start))} · {hhmm(p.period_start)} → </>}{ymd(new Date(p.period_end))} · {hhmm(p.period_end)}</p>}
      {p.status === 'pending' && <VipReviewForm id={p.id} />}
    </article>)}</div>
    <div className="mt-6 flex gap-3">{page > 1 && <Link className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-pitch" href={href(page - 1)}>Trang trước</Link>}{page * 20 < (count ?? 0) && <Link className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-pitch" href={href(page + 1)}>Trang sau</Link>}</div>
  </main>;
}
