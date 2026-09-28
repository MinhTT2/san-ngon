import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/profile';

const Body = z.object({
  full_name: z.string().trim().min(2, 'Họ tên cần ít nhất 2 ký tự.').max(100, 'Họ tên không quá 100 ký tự.'),
  phone: z.string().max(30).transform(normalizePhone).pipe(z.string().regex(/^0\d{9}$/)),
}).strict();

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để sửa thông tin tài khoản.' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Kiểm tra họ tên (2–100 ký tự) và số điện thoại (10 chữ số, bắt đầu bằng 0).' }, { status: 400 });

  const { data, error } = await supabase.rpc('update_profile', {
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
  });
  if (error) {
    const errors: Record<string, [number, string]> = {
      AUTH_REQUIRED: [401, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
      ACCOUNT_BANNED: [403, 'Tài khoản đang bị khóa.'],
      NAME_INVALID: [400, 'Họ tên cần từ 2 đến 100 ký tự.'],
      PHONE_INVALID: [400, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'],
      PROFILE_REQUIRED: [404, 'Không tìm thấy hồ sơ tài khoản.'],
    };
    const [status, message] = errors[error.message] ?? [500, 'Chưa lưu được thông tin. Vui lòng thử lại.'];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ profile: data });
}
