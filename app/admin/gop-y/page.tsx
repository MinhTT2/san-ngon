import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeedbackList } from '@/components/feedback-list';
import { RefreshOnReturn } from '@/components/refresh-on-return';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, type Feedback } from '@/lib/feedback';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Xử lý góp ý — Sân Ngon' };
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; category?: string; page?: string }> }) {
  const params = await searchParams;
  const status = Object.hasOwn(FEEDBACK_STATUSES, params.status ?? '') ? params.status! : '';
  const category = Object.hasOwn(FEEDBACK_CATEGORIES, params.category ?? '') ? params.category! : '';
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1') || 1));
  const href = (p: number) => `/admin/gop-y?${new URLSearchParams({ status, category, page: String(p) })}`;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(href(page))}`);
  const { data: admin, error: permissionError } = await db.rpc('is_admin');
  if (permissionError) throw new Error('Không kiểm tra được quyền quản trị.');
  if (!admin) redirect('/');
  let query = db.from('feedback').select('id,category,title,message,page_path,status,reply,created_at,updated_at,sender:profiles!feedback_user_id_fkey(full_name)', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (error?.code === 'PGRST103' && page > 1) redirect(href(1));
  if (error) throw new Error('Chưa tải được danh sách góp ý.');
  const pages = Math.max(1, Math.ceil((count ?? 0) / 20));
  if (page > pages) redirect(href(pages));
  return <main className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-10">
    <RefreshOnReturn />
    <h1 className="font-display text-3xl font-extrabold text-pitch">Góp ý từ người dùng</h1>
    <p className="mt-3 text-sm leading-6 text-ink-secondary">Tiếp nhận báo lỗi và đề xuất. Phản hồi hiển thị riêng cho người gửi.</p>
    <form className="my-6 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-5">
      <label className="min-w-40 flex-1 text-sm font-semibold">Trạng thái<select name="status" defaultValue={status} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 font-normal"><option value="">Tất cả trạng thái</option>{Object.entries(FEEDBACK_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="min-w-40 flex-1 text-sm font-semibold">Loại<select name="category" defaultValue={category} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 font-normal"><option value="">Tất cả loại</option>{Object.entries(FEEDBACK_CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <button className="min-h-11 rounded-control bg-pitch px-6 py-3 text-sm font-semibold text-pitch-ink">Lọc góp ý</button>
    </form>
    <p className="mb-4 text-sm text-ink-secondary">{count ?? 0} yêu cầu</p>
    <FeedbackList admin rows={(data ?? []) as unknown as (Feedback & { sender: { full_name: string | null } | null })[]} />
    {pages > 1 && <nav aria-label="Phân trang góp ý" className="mt-6 flex justify-center gap-5">{page > 1 && <Link className="min-h-11 py-3 text-sm text-pitch" href={href(page - 1)}>← Trang trước</Link>}<span className="py-3 text-sm">{page}/{pages}</span>{page < pages && <Link className="min-h-11 py-3 text-sm text-pitch" href={href(page + 1)}>Trang sau →</Link>}</nav>}
  </main>;
}
