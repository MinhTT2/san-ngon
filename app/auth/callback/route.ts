import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Sau khi đăng nhập, trả người dùng về đúng nơi họ đang đứng.
 * `next` mang theo đường dẫn và khung giờ đã chọn, để họ không phải chọn lại
 * — khung đó có thể bị người khác lấy trong lúc họ đăng nhập.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/dang-nhap?loi=1`);
}
