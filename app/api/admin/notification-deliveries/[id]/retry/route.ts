import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z.object({ updated_at: z.string().datetime({ offset: true }) }).safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { error } = await db.rpc('retry_notification_delivery', { p_id: id, p_updated_at: body.data.updated_at });
  if (error) {
    const status = error.message.includes('FORBIDDEN') ? 403 : error.message.includes('DELIVERY_NOT_FOUND') ? 404 : error.message.includes('DELIVERY_') ? 409 : 503;
    const message = error.message.includes('DELIVERY_REVIEW_REQUIRED')
      ? 'Cần đối chiếu nhà cung cấp trước khi gửi lại: yêu cầu cũ đã vượt thời gian chống gửi trùng.'
      : status === 409 ? 'Tác vụ đã thay đổi. Tải lại trang trước khi thử lại.' : 'Chưa đưa được thông báo vào hàng đợi.';
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true });
}
