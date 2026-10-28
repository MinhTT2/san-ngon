import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ session_id: z.guid(), active: z.boolean() }).strict();

export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Thông tin không hợp lệ.' }, { status: 400 });
  const { error } = await db.rpc('record_user_activity', { p_session_id: body.data.session_id, p_active: body.data.active });
  if (error) return NextResponse.json({ error: 'Chưa ghi nhận được hoạt động.' }, { status: error.code === '42501' ? 403 : 500 });
  return new NextResponse(null, { status: 204 });
}
