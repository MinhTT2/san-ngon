import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { courtErrorMessage } from '@/lib/constants';
import { CourtManagementBody, validationFieldErrors, rpcFieldErrors } from '@/lib/owner-management';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin sân con không hợp lệ.' }, { status: 400 });
  const parsed = CourtManagementBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.', fieldErrors: validationFieldErrors(parsed.error) }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để sửa sân con.' }, { status: 401 });
  const c = parsed.data;
  const { data, error } = await supabase.rpc('update_court', {
    p_court_id: id, p_name: c.name, p_sport: c.sport, p_surface: c.surface ?? null,
    p_is_indoor: c.is_indoor, p_slot_minutes: c.slot_minutes, p_open_time: c.open_time,
    p_close_time: c.close_time, p_is_active: c.is_active, p_price_per_hour: c.price_per_hour,
  }).single();
  if (error) return NextResponse.json({ error: courtErrorMessage(error.message), fieldErrors: rpcFieldErrors(error.message, courtErrorMessage(error.message)) }, { status: 400 });
  return NextResponse.json({ court: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin sân con không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để xóa sân con.' }, { status: 401 });
  const { error } = await supabase.rpc('delete_court', { p_court_id: id });
  if (error) return NextResponse.json({ error: courtErrorMessage(error.message), fieldErrors: rpcFieldErrors(error.message, courtErrorMessage(error.message)) }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
