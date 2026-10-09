import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeedbackForm } from '@/components/feedback-form';
import { FeedbackList } from '@/components/feedback-list';
import { RefreshOnReturn } from '@/components/refresh-on-return';
import { feedbackSearchParams, type Feedback } from '@/lib/feedback';
import { safeNext } from '@/lib/safe-next';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Góp ý & hỗ trợ — Sân Ngon', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = feedbackSearchParams.parse(await searchParams);
  const page = params.page;
  const pagePath = params.trang && params.trang.length <= 300 && !/[?#]/.test(params.trang) && safeNext(params.trang) === params.trang ? params.trang : null;
  const status = params.status;
  const href = (p: number, targetStatus = status) => `/gop-y?${new URLSearchParams({ page: String(p), ...(targetStatus !== 'all' ? { status: targetStatus } : {}), ...(pagePath ? { trang: pagePath } : {}) })}`;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(href(page))}`);
  let query = db.from('feedback').select('id,category,title,message,booking_id,receipt_path,page_path,status,reply,created_at,updated_at', { count: 'exact' }).eq('user_id', user.id);
  if (status === 'open') query = query.in('status', ['new','reviewing']);
  if (status === 'done') query = query.in('status', ['resolved','closed']);
  const [{ data, count, error }, all, open] = await Promise.all([
    query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 20, page * 20 - 1),
    db.from('feedback').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    db.from('feedback').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['new','reviewing']),
  ]);
  if (all.error || open.error) throw new Error('Chưa tải được tiến độ góp ý.');
  if (error?.code === 'PGRST103' && page > 1) redirect(href(1));
  if (error) throw new Error('Chưa tải được góp ý. Vui lòng thử lại.');
  const pages = Math.max(1, Math.ceil((count ?? 0) / 20));
  if (page > pages) redirect(href(pages));
  const total = all.count ?? 0;
  const openCount = open.count ?? 0;
  const formFirst = total === 0 || !!pagePath;
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
    <RefreshOnReturn />
    <div className="flex flex-wrap items-start justify-between gap-5"><div><h1 className="font-display text-3xl font-extrabold text-pitch">Góp ý & hỗ trợ</h1><p className="mt-3 max-w-xl text-sm leading-7 text-ink-secondary">Theo dõi tiến độ, đọc phản hồi và gửi điều bạn muốn cải thiện.</p></div><div className="flex flex-wrap gap-3"><a href="#gui-gop-y" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Gửi góp ý mới</a><Link href="/tro-giup" className="inline-flex min-h-11 items-center rounded-control border border-hairline px-5 py-3 text-sm font-semibold text-pitch">Trợ giúp nhanh</Link></div></div>
    <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section id="lich-su-gop-y" className={`min-w-0 scroll-mt-6 ${formFirst ? 'order-2 lg:order-1' : 'order-1'}`}>
        <h2 className="font-display text-2xl font-bold text-pitch">Góp ý của bạn ({total})</h2>
        <nav aria-label="Lọc góp ý của bạn" className="my-5 flex gap-1 overflow-x-auto border-b border-hairline">{([['all','Tất cả',total],['open','Đang xử lý',openCount],['done','Đã kết thúc',total-openCount]] as const).map(([key,label,n]) => <Link key={key} scroll={false} href={href(1,key)} aria-current={status === key ? 'page' : undefined} className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-2 text-sm font-semibold sm:px-3 ${status === key ? 'border-pitch text-pitch' : 'border-transparent text-ink-secondary'}`}>{label}<span className="rounded-pill bg-sunk px-2 py-1 text-xs">{n}</span></Link>)}</nav>
        <FeedbackList rows={(data ?? []) as Feedback[]} />
        {pages > 1 && <nav aria-label="Phân trang góp ý" className="mt-6 flex items-center justify-center gap-5">{page > 1 && <Link className="min-h-11 py-3 text-sm text-pitch" href={href(page - 1)}>← Trang trước</Link>}<span className="text-sm">{page}/{pages}</span>{page < pages && <Link className="min-h-11 py-3 text-sm text-pitch" href={href(page + 1)}>Trang sau →</Link>}</nav>}
      </section>
      <aside id="gui-gop-y" className={`min-w-0 scroll-mt-6 ${formFirst ? 'order-1 lg:order-2' : 'order-2'}`}><FeedbackForm pagePath={pagePath} /></aside>
    </div>
  </main>;
}
