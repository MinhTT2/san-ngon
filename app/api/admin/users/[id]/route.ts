import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminErrorMessage } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const Body = z.object({
  full_name: z.string().trim().max(100).optional(),
  phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0').optional().or(z.literal('')),
  role: z.enum(['player', 'owner', 'admin']),
});

/**
 * Sửa hồ sơ người dùng.
 *
 * Route này KHÔNG tự kiểm tra quyền admin — admin_update_user() làm việc đó và
 * ném NOT_ADMIN. Để một chỗ kiểm tra thôi, và chỗ đó là Postgres: người bỏ qua
 * API gọi thẳng RPC bằng anon key cũng vẫn bị chặn.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const { data, error } = await supabase.rpc('admin_update_user', {
    p_id: id,
    p_full_name: parsed.data.full_name ?? null,
    p_phone: parsed.data.phone || null,
    p_role: parsed.data.role,
  }).single();

  if (error) return NextResponse.json({ error: adminErrorMessage(error.message) }, { status: statusFor(error.message) });
  return NextResponse.json({ user: data });
}

/** Xoá hẳn tài khoản. Có đơn đặt sân thì hàm SQL từ chối. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const { error } = await supabase.rpc('admin_delete_user', { p_id: id });
  if (error) return NextResponse.json({ error: adminErrorMessage(error.message) }, { status: statusFor(error.message) });
  return NextResponse.json({ ok: true });
}

function statusFor(message: string) {
  if (message.includes('NOT_ADMIN')) return 403;
  if (message.includes('USER_NOT_FOUND')) return 404;
  return 409;
}
