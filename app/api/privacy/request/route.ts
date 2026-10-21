import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { feedbackErrors } from '@/lib/feedback';
export async function POST(request: Request) {
  const parsed = z.object({ id: z.string().uuid(), action: z.enum(['access','correct','delete']), message: z.string().trim().min(20).max(3000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Chọn loại yêu cầu và mô tả 20–3.000 ký tự.' }, { status: 400 });
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { data, error } = await db.rpc('submit_data_request', { p_id: parsed.data.id, p_action: parsed.data.action, p_message: parsed.data.message });
  if (error) return NextResponse.json({ error: feedbackErrors[error.message] || 'Chưa gửi được. Nội dung vẫn được giữ để thử lại.' }, { status: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503 });
  return NextResponse.json({ id: data });
}
