import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminErrorMessage } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const Body = z.object({
  reason: z.string().trim().min(3, 'Lý do quá ngắn.').max(300),
});

/** Khoá tài khoản. Lý do là bắt buộc — sáu tháng sau không ai nhớ vì sao khoá. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Nhập lý do khoá.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const { data, error } = await supabase.rpc('admin_ban_user', {
    p_id: id,
    p_reason: parsed.data.reason,
  }).single();

  if (error) return NextResponse.json({ error: adminErrorMessage(error.message) }, { status: statusFor(error.message) });
  return NextResponse.json({ user: data });
}

/** Mở khoá. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const { data, error } = await supabase.rpc('admin_unban_user', { p_id: id }).single();
  if (error) return NextResponse.json({ error: adminErrorMessage(error.message) }, { status: statusFor(error.message) });
  return NextResponse.json({ user: data });
}

function statusFor(message: string) {
  if (message.includes('NOT_ADMIN')) return 403;
  if (message.includes('USER_NOT_FOUND')) return 404;
  return 409;
}
