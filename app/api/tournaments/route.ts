import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';
import { participantSchema, tournamentError, tournamentSchema } from '@/lib/tournaments';

const approve = z.union([z.boolean(), z.enum(['true', 'false']).transform(value => value === 'true')]);
const id = z.string().uuid();
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit'), data: tournamentSchema }),
  z.object({ action: z.literal('review'), id, approve, court_id: z.union([id, z.literal('').transform(() => null), z.null()]), note: z.string().trim().max(1000) }),
  z.object({ action: z.literal('register'), id, data: participantSchema }),
  z.object({ action: z.literal('review_registration'), id, approve, note: z.string().trim().max(1000) }),
  z.object({ action: z.literal('cancel_registration'), id }),
  z.object({ action: z.literal('cancel'), id }),
  z.object({ action: z.literal('refund'), transaction_key: z.string().min(1).max(200), expected_amount: z.number().int().positive().max(2147483647) }),
]);
export async function POST(request: Request) {
  if (request.headers.get('origin') !== requestOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Kiểm tra các trường thông tin, thời gian và mức cọc không vượt lệ phí.' }, { status: 400 });
  const body = parsed.data;
  const result = body.action === 'submit' ? await db.rpc('submit_tournament', { p_data: body.data })
    : body.action === 'review' ? await db.rpc('review_tournament', { p_id: body.id, p_approve: body.approve, p_court_id: body.court_id, p_note: body.note })
    : body.action === 'register' ? await db.rpc('register_tournament', { p_id: body.id, p_data: body.data })
    : body.action === 'review_registration' ? await db.rpc('review_tournament_registration', { p_id: body.id, p_approve: body.approve, p_note: body.note })
    : body.action === 'cancel_registration' ? await db.rpc('cancel_tournament_registration', { p_id: body.id })
    : body.action === 'cancel' ? await db.rpc('cancel_tournament', { p_id: body.id })
    : await db.rpc('mark_tournament_refund', { p_transaction_key: body.transaction_key, p_expected_amount: body.expected_amount });
  if (result.error) return NextResponse.json({ error: tournamentError(result.error.message) }, { status: 400 });
  return NextResponse.json({ data: result.data });
}
