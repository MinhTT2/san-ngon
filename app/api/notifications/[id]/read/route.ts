import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wantsJson = req.headers.get('accept')?.includes('application/json');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return wantsJson
    ? NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 })
    : NextResponse.redirect(new URL('/dang-nhap?next=/thong-bao', req.url), 303);

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return NextResponse.json({ error: 'Chưa đánh dấu đã đọc được.' }, { status: 500 });
  if (wantsJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL('/thong-bao', req.url), 303);
}
