import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

/**
 * Đăng xuất. Là POST và làm ở phía server có hai lý do:
 * cookie phiên bị xoá chắc chắn kể cả khi JavaScript hỏng, và một thẻ <img>
 * trên trang khác không thể đá người dùng ra ngoài bằng một request GET.
 */
export async function POST(request: NextRequest) {
  // Chỉ nhận form gửi từ chính trang này.
  const origin = request.headers.get('origin');
  if (origin && origin !== requestOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  // 303: trình duyệt đổi POST thành GET khi đi theo, không hỏi gửi lại form.
  return NextResponse.redirect(new URL('/', requestOrigin(request)), { status: 303 });
}
