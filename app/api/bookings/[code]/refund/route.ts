import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Chủ sân đánh dấu đã chuyển khoản hoàn cọc cho khách. */
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const { data, error } = await supabase.rpc('mark_refund_done', { p_code: code }).single();
  if (error) {
    const status = error.message.includes('BOOKING_NOT_FOUND') ? 404
      : error.message.includes('AUTH_REQUIRED') ? 401 : 409;
    const message = error.message.includes('REFUND_NOT_NEEDED')
      ? 'Đơn này không nằm trong danh sách cần hoàn cọc.'
      : 'Không cập nhật được trạng thái hoàn cọc.';
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ booking: data });
}
