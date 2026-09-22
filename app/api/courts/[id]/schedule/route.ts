import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const DateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin sân không hợp lệ.' }, { status: 400 });
  const date = DateValue.safeParse(new URL(request.url).searchParams.get('date') ?? undefined);
  if (!date.success) return NextResponse.json({ error: date.error.issues[0].message }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để xem lịch sân.' }, { status: 401 });
  const { data, error } = await supabase.rpc('get_owner_court_schedule', { p_court_id: id, p_date: date.data });
  if (error) return NextResponse.json({ error: error.message.includes('COURT_NOT_FOUND') ? 'Không tìm thấy sân.' : 'Không tải được lịch sân.' }, { status: 400 });
  return NextResponse.json({ schedule: data });
}
