import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';
import { feedbackSchema, feedbackReviewSchema, feedbackErrors } from '@/lib/feedback';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== requestOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Kiểm tra tiêu đề (5–120 ký tự), nội dung (20–3.000 ký tự) và trang liên quan.' }, { status: 400 });
  const d = parsed.data;
  const { data, error } = await db.rpc('submit_feedback', { p_id: d.id, p_category: d.category, p_title: d.title, p_message: d.message, p_page_path: d.page_path });
  if (error) return NextResponse.json({ error: feedbackErrors[error.message] ?? 'Chưa gửi được góp ý. Nội dung vẫn được giữ để bạn thử lại.' }, { status: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500 });
  return NextResponse.json({ id: data });
}

export async function PATCH(request: Request) {
  if (request.headers.get('origin') !== requestOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const parsed = feedbackReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Kiểm tra trạng thái và phản hồi. Cần ít nhất 5 ký tự phản hồi khi giải quyết hoặc đóng yêu cầu.' }, { status: 400 });
  const d = parsed.data;
  const { error } = await db.rpc('review_feedback', { p_id: d.id, p_status: d.status, p_reply: d.reply, p_updated_at: d.updated_at });
  if (error) return NextResponse.json({ error: feedbackErrors[error.message] ?? 'Chưa lưu được phản hồi. Vui lòng thử lại.' }, { status: error.code === '42501' ? 403 : error.message === 'FEEDBACK_STALE' ? 409 : error.code === '22023' ? 400 : 500 });
  return NextResponse.json({ ok: true });
}
