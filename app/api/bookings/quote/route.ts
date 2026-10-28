import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { bookingErrorMessage } from '@/lib/constants';

const Body = z.object({
  court_id: z.guid(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Thông tin khung giờ không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { court_id, starts_at, ends_at } = parsed.data;
  const { data, error } = await supabase.rpc('get_booking_quote', {
    p_court_id: court_id, p_starts_at: starts_at, p_ends_at: ends_at,
  });
  if (error) return NextResponse.json({ error: bookingErrorMessage(error.message) }, { status: 400 });
  return NextResponse.json({ quote: data }, { headers: { 'Cache-Control': 'no-store' } });
}
