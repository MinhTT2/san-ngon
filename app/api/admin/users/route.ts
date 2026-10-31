import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { NewUserBody, adminUserError } from '@/lib/admin-users';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { data: admin } = await supabase.rpc('is_admin');
  if (!admin) return NextResponse.json({ error: 'Bạn không có quyền.' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').slice(0, 100);
  const status = params.get('status') ?? 'all';
  const role = params.get('role') ?? 'all';
  const users: unknown[] = [];
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await supabase.rpc('admin_list_users', { p_search: q, p_status: status, p_role: role, p_page: page, p_sort: 'newest' });
    if (error) return NextResponse.json({ error: 'Không tải được danh sách.' }, { status: 500 });
    const batch = (data?.users ?? []) as unknown[];
    users.push(...batch);
    if (batch.length < 20) break;
  }
  return NextResponse.json({ users });
}

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
