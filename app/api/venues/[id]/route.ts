import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { venueErrorMessage } from '@/lib/constants';
import { VenueManagementBody } from '@/lib/owner-management';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin cụm sân không hợp lệ.' }, { status: 400 });
  const parsed = VenueManagementBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để quản lý cụm sân.' }, { status: 401 });
  const v = parsed.data;
  const { data, error } = await supabase.rpc('update_venue', {
    p_venue_id: id, p_name: v.name, p_address: v.address, p_district: v.district,
    p_phone: v.phone, p_description: v.description ?? null, p_open_time: v.open_time,
    p_close_time: v.close_time, p_deposit_pct: v.deposit_pct, p_booking_horizon_days: v.booking_horizon_days,
  }).single();
  if (error) return NextResponse.json({ error: venueErrorMessage(error.message) }, { status: error.message.includes('AUTH_REQUIRED') ? 401 : 400 });
  return NextResponse.json({ venue: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin cụm sân không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để xóa cụm sân.' }, { status: 401 });
  const { error } = await supabase.rpc('delete_venue', { p_venue_id: id });
  if (error) return NextResponse.json({ error: venueErrorMessage(error.message) }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
