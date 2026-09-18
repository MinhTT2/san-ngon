import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/dang-nhap?next=/thong-bao', req.url));

  const { data: notification } = await supabase
    .from('notifications')
    .select('booking:bookings(code)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null);

  const bookingData = notification?.booking as unknown;
  const booking = (Array.isArray(bookingData) ? bookingData[0] : bookingData) as { code: string } | null | undefined;
  return NextResponse.redirect(new URL(booking?.code ? `/dat-san/${booking.code}` : '/thong-bao', req.url));
}
