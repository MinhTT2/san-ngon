import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, MessageSquare, Search } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { AdminFeedbackList } from '@/components/admin-feedback-list';
import { QueryError } from '@/components/query-error';
import { createClient } from '@/lib/supabase/server';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from '@/lib/feedback';
import { ADMIN_FEEDBACK_PAGE_SIZE, adminFeedbackHref, adminFeedbackSearchParams, feedbackTextFilter, type AdminFeedbackSummary } from '@/lib/admin-feedback';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Xử lý góp ý — Sân Ngon' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = adminFeedbackSearchParams.parse(await searchParams);
  const { status, category, q, sort, page } = filters;
  const href = (p: number) => adminFeedbackHref(filters, { page: p });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(href(page))}`);
  const { data: admin, error: permissionError } = await db.rpc('is_admin');
  if (permissionError) throw new Error('Không kiểm tra được quyền quản trị.');
  if (!admin) redirect('/');

  // Read this page of summaries; full messages and replies live on the detail page.
  let query = db.from('feedback').select('id,category,title,status,created_at,receipt_path,sender:profiles!feedback_user_id_fkey(full_name)', { count: 'exact' });
  if (status === 'open') query = query.in('status', ['new', 'reviewing']);
  else if (status === 'done') query = query.in('status', ['resolved', 'closed']);
  else if (status !== 'all') query = query.eq('status', status);
  if (category !== 'all') query = query.eq('category', category);
  if (q) query = query.or(feedbackTextFilter(q));

  const [result, ...metrics] = await Promise.all([
    query.order('created_at', { ascending: sort === 'oldest' }).order('id', { ascending: sort === 'oldest' }).range((page - 1) * ADMIN_FEEDBACK_PAGE_SIZE, page * ADMIN_FEEDBACK_PAGE_SIZE - 1),
    ...(['new', 'reviewing', 'done'] as const).map(state => {
      const count = db.from('feedback').select('id', { head: true, count: 'exact' });
      return state === 'done' ? count.in('status', ['resolved', 'closed']) : count.eq('status', state);
    }),
  ]);
  const { data, count, error } = result;
  if (error?.code === 'PGRST103' && page > 1) redirect(href(1));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / ADMIN_FEEDBACK_PAGE_SIZE));
  if (!error && page > pages) redirect(href(pages));
  const metricItems = [
    { label: 'Chờ xử lý', hint: 'Yêu cầu mới cần xem', status: 'new' as const },
    { label: 'Đang xử lý', hint: 'Tiếp tục các yêu cầu đã nhận', status: 'reviewing' as const },
    { label: 'Đã kết thúc', hint: 'Đã giải quyết hoặc đóng', status: 'done' as const },
  ];
  const hasFilters = q || category !== 'all' || status !== 'open' || sort !== 'oldest';

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Quản trị / Hỗ trợ" title="Góp ý từ người dùng" description="Ưu tiên yêu cầu chưa xử lý. Mở từng yêu cầu để xem nội dung và phản hồi riêng cho người gửi." />
    <section aria-label="Tổng quan góp ý" className="my-6 grid grid-cols-3 gap-2 sm:gap-3">
      {metricItems.map((item, index) => <Link key={item.label} href={adminFeedbackHref(filters, { q: '', category: 'all', status: item.status, page: 1 })} className={`rounded-card border p-3 hover:border-pitch sm:p-4 ${status === item.status && !q && category === 'all' ? 'border-pitch bg-free-fill' : 'border-hairline bg-card'}`}>
        <span className="flex items-center justify-between gap-2 text-xs font-semibold text-pitch sm:text-sm">{item.label}<ArrowRight size={16} aria-hidden="true" className="hidden sm:block" /></span>
        <span className="mt-2 block font-display text-3xl font-bold text-pitch">{metrics[index].error ? '—' : metrics[index].count ?? 0}</span>
        <span className="mt-1 hidden text-xs text-ink-secondary sm:block">{metrics[index].error ? 'Chưa tải được số lượng' : item.hint}</span>
      </Link>)}
    </section>
    <form key={href(page)} action="/admin/gop-y" role="search" aria-label="Tìm và lọc góp ý" className="mb-6 grid gap-4 rounded-card border border-hairline bg-card p-4 sm:p-5">
      <label className="block text-sm font-semibold">Tìm yêu cầu
        <span className="relative mt-2 block"><Search size={18} aria-hidden="true" className="absolute left-3 top-3 text-ink-secondary" /><input type="search" name="q" defaultValue={q} maxLength={100} placeholder="Tiêu đề, nội dung hoặc mã đơn…" className="min-h-11 w-full rounded-control border border-hairline bg-page pl-10 pr-3 text-sm font-normal" /></span>
      </label>
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="min-w-0 text-sm font-semibold">Trạng thái<select name="status" defaultValue={status} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="open">Chưa xử lý xong</option><option value="all">Tất cả trạng thái</option><option value="done">Đã kết thúc</option>{Object.entries(FEEDBACK_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Loại yêu cầu<select name="category" defaultValue={category} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="all">Tất cả loại</option>{Object.entries(FEEDBACK_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Sắp xếp<select name="sort" defaultValue={sort} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="oldest">Cũ nhất trước</option><option value="newest">Mới nhất trước</option></select></label>
        <button className="pf-action min-h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Tìm và lọc</button>
      </div>
      {hasFilters && <Link href="/admin/gop-y" className="inline-flex min-h-11 items-center justify-self-start text-sm font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>}
    </form>
    <section aria-label="Danh sách góp ý">
      {error ? <QueryError title="Chưa tải được danh sách góp ý" /> : <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-pitch">{status === 'open' ? 'Yêu cầu cần xử lý' : 'Danh sách yêu cầu'}</h2>
          <p className="text-sm text-ink-secondary">{total ? `${(page - 1) * ADMIN_FEEDBACK_PAGE_SIZE + 1}–${Math.min(page * ADMIN_FEEDBACK_PAGE_SIZE, total)} / ${total} yêu cầu` : '0 yêu cầu'}</p>
        </div>
        {data?.length ? <AdminFeedbackList rows={data as unknown as AdminFeedbackSummary[]} returnTo={href(page)} /> : <div role="status" className="rounded-card border border-hairline bg-card px-5 py-12 text-center">
          <MessageSquare size={26} aria-hidden="true" className="mx-auto text-ink-secondary" />
          <h3 className="mt-3 font-semibold text-pitch">{hasFilters ? 'Không có yêu cầu phù hợp' : 'Đã xử lý hết yêu cầu hiện có'}</h3>
          <p className="mt-2 text-sm text-ink-secondary">{hasFilters ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.' : 'Yêu cầu mới sẽ xuất hiện tại đây. Bạn có thể xem lại lịch sử đã xử lý.'}</p>
          <Link href={hasFilters ? '/admin/gop-y' : adminFeedbackHref(filters, { status: 'all', page: 1 })} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">{hasFilters ? 'Xóa bộ lọc' : 'Xem tất cả yêu cầu'}</Link>
        </div>}
        {pages > 1 && <nav aria-label="Phân trang góp ý" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {page > 1 ? <Link className="min-h-11 rounded-control border border-hairline bg-card px-4 py-3 text-sm font-semibold text-pitch" href={href(page - 1)}>← Trang trước</Link> : <span aria-disabled="true" className="px-4 py-3 text-sm text-ink-secondary">← Trang trước</span>}
          <span className="text-sm text-ink-secondary">Trang {page} / {pages}</span>
          {page < pages ? <Link className="min-h-11 rounded-control border border-hairline bg-card px-4 py-3 text-sm font-semibold text-pitch" href={href(page + 1)}>Trang sau →</Link> : <span aria-disabled="true" className="px-4 py-3 text-sm text-ink-secondary">Trang sau →</span>}
        </nav>}
      </>}
    </section>
  </main>;
}
