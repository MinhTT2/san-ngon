import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { NewUserBody, adminUserError } from '@/lib/admin-users';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const parsed = NewUserBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const v = parsed.data;
  const { data, error } = await supabase.rpc('admin_save_user', { p_id: null, p_full_name: v.full_name, p_phone: v.phone, p_role: v.role, p_email: v.email, p_password: v.password });
  if (error) { const result = adminUserError(error.message); return NextResponse.json({ error: result.error }, { status: result.status }); }
  return NextResponse.json({ id: data }, { status: 201 });
}
