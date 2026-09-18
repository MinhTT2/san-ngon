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
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error('[auth] đổi code lấy phiên hỏng', error.message);
  }
  return NextResponse.redirect(`${origin}/dang-nhap?loi=1`);
}

/**
 * Chỉ nhận đường dẫn nội bộ.
 *
 * `next` đi ra ngoài trong link email nên người khác sửa được. Một giá trị
 * tuyệt đối như "https://..." ghép vào origin ra chuỗi không phải URL hợp lệ,
 * NextResponse.redirect ném lỗi và người dùng vừa đăng nhập xong thì gặp trang
 * lỗi 500. "//host" thì ghép ra đường dẫn cùng origin, không dẫn ra ngoài
 * được, nhưng vẫn chặn cho gọn.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
