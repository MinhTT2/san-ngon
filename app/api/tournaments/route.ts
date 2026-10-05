import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';
import { participantSchema, tournamentError, tournamentErrorFields, tournamentSchema, tournamentValidationErrors } from '@/lib/tournaments';

const approve = z.union([z.boolean(), z.enum(['true', 'false']).transform(value => value === 'true')]);
const id = z.string().uuid();
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submit'), data: tournamentSchema }),
  z.object({ action: z.literal('resubmit'), id, data: tournamentSchema }),
  z.object({ action: z.literal('terms'), id, venue_fee: z.coerce.number().int().min(0).max(100000000), cancellation_venue_fee: z.coerce.number().int().min(0).max(100000000), terms_note: z.string().trim().min(10).max(1000) }),
  z.object({ action: z.literal('balance'), id, refund: approve, receipt: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal('waive_balance'), id, note: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal('transfer'), id, expected_balance: z.number().int().safe(), receipt: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal('receive_transfer'), id }),
  z.object({ action: z.literal('review'), id, approve, court_id: z.union([id, z.literal('').transform(() => null), z.null()]), note: z.string().trim().max(1000), venue_fee: z.coerce.number().int().min(0).max(100000000), cancellation_venue_fee: z.coerce.number().int().min(0).max(100000000), terms_note: z.string().trim().max(1000), terms_confirmed: z.boolean() }),
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
  if (!parsed.success) {
    console.warn('Tournament input rejected', { issues: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), code: issue.code })) });
    const fieldErrors = tournamentValidationErrors(parsed.error.issues);
    return NextResponse.json({ error: Object.values(fieldErrors)[0] ?? 'Kiểm tra các trường thông tin đã nhập.', fieldErrors }, { status: 400 });
  }
  const body = parsed.data;
  const result = body.action === 'submit' ? await db.rpc('submit_tournament', { p_data: body.data })
    : body.action === 'review' ? await db.rpc('review_tournament', { p_id: body.id, p_approve: body.approve, p_court_id: body.court_id, p_note: body.note, p_venue_fee: body.venue_fee, p_cancellation_venue_fee: body.cancellation_venue_fee, p_terms_note: body.terms_note, p_terms_confirmed: body.terms_confirmed })
    : body.action === 'resubmit' ? await db.rpc('resubmit_tournament', { p_id: body.id, p_data: body.data })
    : body.action === 'terms' ? await db.rpc('set_tournament_terms', { p_id: body.id, p_venue_fee: body.venue_fee, p_cancellation_venue_fee: body.cancellation_venue_fee, p_note: body.terms_note })
    : body.action === 'balance' ? await db.rpc('record_tournament_balance', { p_id: body.id, p_refund: body.refund, p_receipt: body.receipt })
    : body.action === 'waive_balance' ? await db.rpc('waive_tournament_balance', { p_id: body.id, p_note: body.note })
    : body.action === 'transfer' ? await db.rpc('record_tournament_transfer', { p_id: body.id, p_expected_balance: body.expected_balance, p_receipt: body.receipt })
    : body.action === 'receive_transfer' ? await db.rpc('confirm_tournament_transfer', { p_id: body.id })
    : body.action === 'register' ? await db.rpc('register_tournament', { p_id: body.id, p_data: body.data })
    : body.action === 'review_registration' ? await db.rpc('review_tournament_registration', { p_id: body.id, p_approve: body.approve, p_note: body.note })
    : body.action === 'cancel_registration' ? await db.rpc('cancel_tournament_registration', { p_id: body.id })
    : body.action === 'cancel' ? await db.rpc('cancel_tournament', { p_id: body.id })
    : await db.rpc('mark_tournament_refund', { p_transaction_key: body.transaction_key, p_expected_amount: body.expected_amount });
  if (result.error) {
    console.warn('Tournament action rejected', { action: body.action, code: result.error.code, reason: /^[A-Z_]+$/.test(result.error.message) ? result.error.message : 'DATABASE_ERROR' });
    const error = tournamentError(result.error.message);
    const field = tournamentErrorFields[result.error.message];
    return NextResponse.json({ error, fieldErrors: field && ['submit', 'resubmit'].includes(body.action) ? { [field]: error } : {} }, { status: 400 });
  }
  return NextResponse.json({ data: result.data });
}
