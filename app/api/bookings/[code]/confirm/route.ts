import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Chủ sân xác nhận đã nhận cọc khi webhook SePay không chạy. */
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const { data, error } = await supabase.rpc('confirm_payment_manual', { p_code: code }).single();
  if (error) {
    const status = error.message.includes('BOOKING_NOT_FOUND') ? 404
      : error.message.includes('AUTH_REQUIRED') ? 401 : 409;
    const message = error.message.includes('NOT_PENDING')
      ? 'Đơn này không còn ở trạng thái chờ chuyển khoản.'
      : 'Không xác nhận được đơn. Kiểm tra lại quyền chủ sân.';
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ booking: data });
}
