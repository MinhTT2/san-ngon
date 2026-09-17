import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Kiểu cookie mà @supabase/ssr trả về trong setAll. Khai báo tay vì hàm có
 *  hai overload (bản get/set cũ và bản getAll/setAll), TypeScript không tự suy được. */
type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Gọi từ Server Component — middleware lo việc refresh session.
          }
        },
      },
    }
  );
}
