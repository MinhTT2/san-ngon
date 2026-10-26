import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { vipError } from '@/lib/vip';

export async function POST() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { error } = await db.rpc('create_vip_purchase');
  if (error) return NextResponse.json({ error: vipError(error.message) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
export async function PATCH(request: Request) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Mã yêu cầu không hợp lệ.' }, { status: 400 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { error } = await db.rpc('submit_vip_purchase', { p_id: parsed.data.id });
  if (error) return NextResponse.json({ error: vipError(error.message) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
