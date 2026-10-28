import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
export async function POST(request: Request) {
  const parsed = z.object({ kind: z.enum(['community', 'tournament']), id: z.guid(), hidden: z.boolean(), reason: z.string().trim().min(10).max(1000), updated_at: z.string().datetime({ offset: true }).nullable() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Kiểm tra nội dung và lý do 10–1.000 ký tự.' }, { status: 400 });
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const d = parsed.data; const { error } = await db.rpc('set_content_moderation', { p_kind: d.kind, p_id: d.id, p_hidden: d.hidden, p_reason: d.reason, p_updated_at: d.updated_at ?? undefined });
  if (error) return NextResponse.json({ error: error.message === 'CONTENT_CHANGED' ? 'Nội dung vừa được xử lý. Tải lại để xem trạng thái mới.' : 'Chưa lưu được. Kiểm tra quyền hoặc tải lại.' }, { status: error.code === '42501' ? 403 : error.message === 'CONTENT_CHANGED' ? 409 : 503 });
  return NextResponse.json({ ok: true });
}
