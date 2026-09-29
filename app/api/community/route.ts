import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';
import { communitySchema } from '@/lib/community';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== requestOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const data = communitySchema.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: 'Kiểm tra thông tin và đường dẫn Facebook (https://facebook.com/…).'}, { status: 400 });
  const { error } = await db.rpc('set_community_profile', { p_data: data.data });
  if (error) return NextResponse.json({ error: 'Chưa lưu được. Kiểm tra số điện thoại 10 chữ số và trạng thái tài khoản.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
