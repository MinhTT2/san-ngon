import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cancelErrorMessage } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Hủy đơn. RLS không cho người đặt update thẳng bảng bookings, nên đường hủy
 * duy nhất là hàm cancel_booking() — nó tự quyết cọc có được hoàn hay không.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_code: code, p_pending_only: body?.pending_only === true,
  }).single();

  if (error) {
    const status = error.message.includes('BOOKING_NOT_FOUND') ? 404
      : error.message.includes('AUTH_REQUIRED') ? 401
      : 409;
    return NextResponse.json({ error: cancelErrorMessage(error.message) }, { status });
  }

  return NextResponse.json({ booking: data });
}
