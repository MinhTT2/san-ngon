import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeedbackForm } from '@/components/feedback-form';
import { FeedbackList } from '@/components/feedback-list';
import { RefreshOnReturn } from '@/components/refresh-on-return';
import type { Feedback } from '@/lib/feedback';
import { safeNext } from '@/lib/safe-next';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Góp ý & hỗ trợ — Sân Ngon', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ trang?: string; page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1') || 1));
  const pagePath = params.trang && params.trang.length <= 300 && !/[?#]/.test(params.trang) && safeNext(params.trang) === params.trang ? params.trang : null;
  const href = (p: number) => `/gop-y?${new URLSearchParams({ page: String(p), ...(pagePath ? { trang: pagePath } : {}) })}`;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(href(page))}`);
  const { data, count, error } = await db.from('feedback').select('id,category,title,message,page_path,status,reply,created_at,updated_at', { count: 'exact' })
    .eq('user_id', user.id).order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (error?.code === 'PGRST103' && page > 1) redirect(href(1));
  if (error) throw new Error('Chưa tải được góp ý. Vui lòng thử lại.');
  const pages = Math.max(1, Math.ceil((count ?? 0) / 20));
  if (page > pages) redirect(href(pages));
  return <main className="mx-auto max-w-5xl px-5 py-10 lg:px-12">
    <RefreshOnReturn />
    <h1 className="font-display text-3xl font-extrabold text-pitch">Góp ý & hỗ trợ</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-secondary">Báo lỗi, đề xuất cải thiện hoặc hỏi về trải nghiệm website. Phản hồi được lưu ngay tại đây; mở lại trang để xem tiến độ mới nhất.</p>
    <div className="mt-7"><FeedbackForm pagePath={pagePath} /></div>
    <div className="mb-5 mt-10 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl font-bold text-pitch">Góp ý của bạn ({count ?? 0})</h2><Link href="/tro-giup" className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Xem câu hỏi thường gặp</Link></div>
    <FeedbackList rows={(data ?? []) as Feedback[]} />
    {pages > 1 && <nav aria-label="Phân trang góp ý" className="mt-6 flex items-center justify-center gap-5">{page > 1 && <Link className="min-h-11 py-3 text-sm text-pitch" href={href(page - 1)}>← Trang trước</Link>}<span className="text-sm">{page}/{pages}</span>{page < pages && <Link className="min-h-11 py-3 text-sm text-pitch" href={href(page + 1)}>Trang sau →</Link>}</nav>}
  </main>;
}
