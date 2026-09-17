import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { bookingErrorMessage } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const Body = z.object({
  court_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  customer_name: z.string().trim().max(100).optional(),
  customer_phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0'),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để đặt sân.' }, { status: 401 });
  }

  const b = parsed.data;
  // Giá KHÔNG nhận từ client. create_booking tự tra price_rules và tính lại.
  const { data, error } = await supabase.rpc('create_booking', {
    p_court_id: b.court_id,
    p_starts_at: b.starts_at,
    p_ends_at: b.ends_at,
    p_customer_name: b.customer_name ?? null,
    p_customer_phone: b.customer_phone,
    p_note: b.note ?? null,
  }).single();

  if (error) {
    const status = error.message.includes('SLOT_TAKEN') ? 409
      : error.message.includes('AUTH_REQUIRED') ? 401
      : 400;
    return NextResponse.json({ error: bookingErrorMessage(error.message) }, { status });
  }

  return NextResponse.json({ booking: data }, { status: 201 });
}
