import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { vipError } from '@/lib/vip';

const Body = z.discriminatedUnion('approve', [
  z.object({ id: z.guid(), approve: z.literal(true), transaction_id: z.string().trim().regex(/^[1-9]\d{0,29}$/), verified: z.literal(true) }),
  z.object({ id: z.guid(), approve: z.literal(false), reason: z.string().trim().min(5).max(500) }),
]);
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Kiểm tra mã giao dịch, xác nhận đối soát hoặc lý do từ chối.' }, { status: 400 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const v = parsed.data;
  const { error } = await db.rpc('review_vip_purchase', { p_id: v.id, p_approve: v.approve,
    p_transaction_id: v.approve ? v.transaction_id : null, p_reason: v.approve ? null : v.reason });
  if (error) return NextResponse.json({ error: vipError(error.message) }, { status: error.message.includes('FORBIDDEN') ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
