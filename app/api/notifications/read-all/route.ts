import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { NotificationSearchParams } from '@/lib/search-params';
import { requestOrigin } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const origin = requestOrigin(req);
  if (req.headers.get('origin') && req.headers.get('origin') !== origin) {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  }
  const wantsJson = req.headers.get('accept')?.includes('application/json');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return wantsJson
    ? NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 })
    : NextResponse.redirect(new URL('/dang-nhap?next=/thong-bao', origin), 303);

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return NextResponse.json({ error: 'Chưa đánh dấu tất cả đã đọc được.' }, { status: 500 });
  if (wantsJson) return NextResponse.json({ ok: true });
  const form = await req.formData().catch(() => new FormData());
  const { status } = NotificationSearchParams.parse({ status: form.get('status') });
  return NextResponse.redirect(new URL(`/thong-bao?${new URLSearchParams({ status, page: '1' })}`, origin), 303);
}
