import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { courtErrorMessage } from '@/lib/constants';
import { CourtCreateBody } from '@/lib/owner-management';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = CourtCreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để thêm sân con.' }, { status: 401 });
  const c = parsed.data;
  const { data, error } = await supabase.rpc('create_court', {
    p_venue_id: parsed.data.venue_id, p_name: c.name, p_sport: c.sport, p_surface: c.surface ?? null,
    p_is_indoor: c.is_indoor, p_slot_minutes: c.slot_minutes, p_open_time: c.open_time,
    p_close_time: c.close_time, p_price_per_hour: c.price_per_hour,
  }).single();
  if (error) return NextResponse.json({ error: courtErrorMessage(error.message) }, { status: 400 });
  return NextResponse.json({ court: data }, { status: 201 });
}
