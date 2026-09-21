import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  let body: { status?: string } = {};
  try { body = await request.json(); } catch { /* body không hợp lệ sẽ trả 400 bên dưới */ }
  if (body.status !== 'active' && body.status !== 'rejected') {
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 });
  }

  const { id } = await params;
  const { error } = await supabase.from('venues').update({ status: body.status }).eq('id', id);
  if (error) return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
