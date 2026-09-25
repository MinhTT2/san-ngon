import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { subscriptionError } from '@/lib/subscriptions';
import { requestOrigin } from '@/lib/request-origin';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invoice') }),
  z.object({ action: z.literal('set_fee'), owner_id: z.string().uuid(), required: z.boolean() }),
]);
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== requestOrigin(req)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Thông tin không hợp lệ.' }, { status: 400 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const body = parsed.data;
  const { data, error } = body.action === 'invoice'
    ? await db.rpc('create_subscription_invoice')
    : await db.rpc('set_owner_subscription_fee', { p_owner_id: body.owner_id, p_required: body.required });
  if (error) return NextResponse.json({ error: subscriptionError(error.message) }, { status: error.message.includes('FORBIDDEN') ? 403 : 400 });
  return NextResponse.json({ ok: true, invoice: data });
}
