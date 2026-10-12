import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, ExternalLink, Paperclip } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { FeedbackReviewForm } from '@/components/feedback-review-form';
import { FeedbackStatus } from '@/components/feedback-status';
import { createClient } from '@/lib/supabase/server';
import { FEEDBACK_CATEGORIES } from '@/lib/feedback';
import { feedbackReturnHref, type AdminFeedback } from '@/lib/admin-feedback';
import { dayLabel, hhmm, ymd } from '@/lib/format';
import { safeNext } from '@/lib/safe-next';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chi tiết góp ý — Sân Ngon' };

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const back = feedbackReturnHref((await searchParams).back);
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(`/admin/gop-y/${id}?${new URLSearchParams({ back })}`)}`);
  const { data: admin, error: permissionError } = await db.rpc('is_admin');
  if (permissionError) throw new Error('Không kiểm tra được quyền quản trị.');
  if (!admin) redirect('/');
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { data, error } = await db.from('feedback')
    .select('id,category,title,message,booking_id,receipt_path,page_path,status,reply,created_at,updated_at,sender:profiles!feedback_user_id_fkey(full_name)')
    .eq('id', id).maybeSingle();
  if (error) throw new Error('Chưa tải được nội dung góp ý.');
  if (!data) notFound();
  const row = data as unknown as AdminFeedback;
  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <Link href={back} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch"><ArrowLeft size={16} aria-hidden="true" />Về danh sách góp ý</Link>
    <DashboardPageHeader eyebrow="Quản trị / Hỗ trợ / Chi tiết" title={row.title} description="Nội dung và chứng từ chỉ hiển thị cho người gửi và quản trị viên." />
    <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <section aria-label="Nội dung yêu cầu" className="min-w-0 rounded-card border border-hairline bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-pitch">{FEEDBACK_CATEGORIES[row.category]}</p><FeedbackStatus status={row.status} /></div>
        <dl className="mt-5 grid gap-4 border-b border-hairline pb-5 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-xs text-ink-secondary">Người gửi</dt><dd className="mt-1 break-words font-semibold">{row.sender?.full_name || 'Chưa đặt tên'}</dd></div>
          <div><dt className="text-xs text-ink-secondary">Ngày gửi</dt><dd className="mt-1 text-xs leading-6"><time dateTime={row.created_at}>{dayLabel(new Date(row.created_at))}/{ymd(new Date(row.created_at)).slice(0, 4)} · {hhmm(row.created_at)}</time></dd></div>
        </dl>
        <h2 className="mt-5 text-sm font-semibold">Nội dung người dùng gửi</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{row.message}</p>
        {(row.page_path || row.receipt_path) && <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline pt-4">
          {row.page_path && safeNext(row.page_path) === row.page_path && <Link href={row.page_path} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4">Mở trang liên quan<ExternalLink size={15} aria-hidden="true" /></Link>}
          {row.receipt_path && <a href={`/api/feedback/${row.id}/receipt`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4"><Paperclip size={15} aria-hidden="true" />Xem chứng từ riêng tư</a>}
        </div>}
      </section>
      <section aria-labelledby="phan-hoi" className="min-w-0 rounded-card border border-hairline bg-card p-5 sm:p-6">
        <h2 id="phan-hoi" className="font-display text-xl font-bold text-pitch">Xử lý và phản hồi</h2>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">Cập nhật tiến độ hoặc ghi kết quả để người gửi theo dõi.</p>
        <FeedbackReviewForm key={row.updated_at} feedback={row} returnTo={back} />
      </section>
    </div>
  </main>;
}
