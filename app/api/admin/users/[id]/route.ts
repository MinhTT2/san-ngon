import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserBody, UserActionBody, adminUserError } from '@/lib/admin-users';

type Context = { params: Promise<{ id: string }> };
async function mutate(request: Request, { params }: Context, action: 'edit' | 'status' | 'delete') {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Mã tài khoản không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  let result;
  if (action === 'delete') result = await supabase.rpc('admin_user_action', { p_id: id, p_action: 'delete' });
  else if (action === 'edit') {
    const parsed = UserBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const v = parsed.data;
    result = await supabase.rpc('admin_save_user', { p_id: id, p_full_name: v.full_name, p_phone: v.phone, p_role: v.role });
  } else {
    const parsed = UserActionBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const v = parsed.data;
    result = await supabase.rpc('admin_user_action', { p_id: id, p_action: v.action, p_reason: v.action === 'ban' ? v.reason : null, p_days: v.action === 'ban' ? v.days : null });
  }
  if (result.error) { const error = adminUserError(result.error.message); return NextResponse.json({ error: error.error }, { status: error.status }); }
  return NextResponse.json({ ok: true });
}
export const PATCH = (request: Request, context: Context) => mutate(request, context, 'edit');
export const POST = (request: Request, context: Context) => mutate(request, context, 'status');
export const DELETE = (request: Request, context: Context) => mutate(request, context, 'delete');
