import { NextRequest, NextResponse } from 'next/server';
import { VenueCreateBody, validationFieldErrors, rpcFieldErrors } from '@/lib/owner-management';
import { createClient } from '@/lib/supabase/server';
import { venueErrorMessage } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const parsed = VenueCreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.', fieldErrors: validationFieldErrors(parsed.error) }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để tạo cụm sân.' }, { status: 401 });
  const v = parsed.data;
  const { data, error } = await supabase.rpc('create_venue', {
    p_name: v.name,
    p_address: v.address,
    p_district: v.district,
    p_phone: v.phone,
    p_description: v.description ?? null,
    p_open_time: v.open_time,
    p_close_time: v.close_time,
    p_sports: v.sports,
  }).single();
  if (error) return NextResponse.json({ error: venueErrorMessage(error.message), fieldErrors: rpcFieldErrors(error.message, venueErrorMessage(error.message)) }, { status: error.message.includes('AUTH_REQUIRED') ? 401 : 400 });
  return NextResponse.json({ venue: data }, { status: 201 });
}
