import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Xem chú thích trong lib/supabase/server.ts — phải khai kiểu tay. */
type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Làm mới session. Bỏ dòng này thì người dùng bị đăng xuất ngẫu nhiên.
  const { data: { user } } = await supabase.auth.getUser();
  // Supabase JWT không biết trạng thái khóa trong profiles. Kiểm tra ở biên
  // request để phiên cũ cũng mất quyền ngay sau khi admin khóa tài khoản.
  if (user && !request.nextUrl.pathname.startsWith('/dang-nhap') && !request.nextUrl.pathname.startsWith('/auth/')) {
    const { data: profile } = await supabase.from('profiles').select('banned_until').eq('id', user.id).maybeSingle();
    if (profile?.banned_until && (profile.banned_until === 'infinity' || new Date(profile.banned_until).getTime() > Date.now())) {
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Tài khoản đang bị khóa.' }, { status: 403 });
      }
      const target = new URL('/dang-nhap', request.url);
      target.searchParams.set('error', 'account_banned');
      target.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(target);
    }
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
