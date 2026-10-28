import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminUserError } from '@/lib/admin-users';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!z.guid().safeParse(id).success || !parsed.success) {
    return NextResponse.json({ error: 'Thông tin VIP không hợp lệ.' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { error } = await supabase.rpc('admin_set_user_vip', { p_user_id: id, p_enabled: parsed.data.enabled });
  if (error) {
    const translated = adminUserError(error.message);
    return NextResponse.json({ error: translated.error }, { status: translated.status });
  }
  return NextResponse.json({ ok: true });
}
