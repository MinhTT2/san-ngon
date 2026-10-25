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
    .select('vip_purchase_id,tournament_id,booking:bookings(code)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null);

  if (notification?.vip_purchase_id) {
    const { data: admin } = await supabase.rpc('is_admin');
    return NextResponse.redirect(new URL(admin ? '/admin/vip' : '/vip', req.url));
  }
  const bookingData = notification?.booking as unknown;
  const booking = (Array.isArray(bookingData) ? bookingData[0] : bookingData) as { code: string } | null | undefined;
  return NextResponse.redirect(new URL(notification?.tournament_id ? `/giai-dau/${notification.tournament_id}` : booking?.code ? `/dat-san/${booking.code}` : '/thong-bao', req.url));
}
