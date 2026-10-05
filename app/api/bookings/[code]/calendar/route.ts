import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bookingCalendar, type BookingCalendar } from '@/lib/calendar';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (!/^SAN[A-HJ-NP-Z2-9]{6}$/.test(code)) return NextResponse.json({ error: 'Mã đơn không hợp lệ.' }, { status: 400, headers });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401, headers });
  const { data, error } = await db.rpc('get_booking_calendar', { p_code: code });
  if (error) return NextResponse.json({ error: 'Chưa tải được lịch. Vui lòng thử lại.' }, { status: error.code === '42501' ? 403 : 500, headers });
  if (!data) return NextResponse.json({ error: 'Không có đơn đã xác nhận để tải lịch.' }, { status: 404, headers });
  return new Response(bookingCalendar(data as BookingCalendar), { headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="san-ngon-${code}.ics"`, 'X-Content-Type-Options': 'nosniff' } });
}
