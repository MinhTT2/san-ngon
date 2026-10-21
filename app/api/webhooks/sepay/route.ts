import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractBookingCodes, extractSubscriptionCodes, extractTournamentCodes } from '@/lib/sepay';
import { secretHash } from '@/lib/sepay-crypto';
import type { ConfirmPaymentResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IncomingTransfer = z.object({
  id: z.union([z.number().int().positive().safe(), z.string().max(50).regex(/^[1-9]\d*$/)]),
  gateway: z.string().trim().min(1).max(100),
  accountNumber: z.string().trim().regex(/^\d{6,30}$/),
  transferType: z.literal('in'),
  transferAmount: z.number().int().positive().max(2147483647),
  content: z.string().nullish(),
  description: z.string().nullish(),
  code: z.string().nullish(),
  subAccount: z.string().nullish(),
}).passthrough();

/**
 * Cửa duy nhất từ bên ngoài vào hệ thống, và nó luôn mở.
 * Bảo vệ bằng API key. Luôn trả 200 khi bỏ qua giao dịch — trả lỗi chỉ khiến SePay retry vô ích.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const connectionId = req.nextUrl.searchParams.get('connection');
  // Validate credentials before opening a privileged database client.
  if (connectionId !== null) {
    if (!z.string().uuid().safeParse(connectionId).success || !auth.startsWith('Apikey ') || auth.length > 256) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }
  } else if (!process.env.SEPAY_WEBHOOK_API_KEY || auth !== `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const supabase = createAdminClient();
  let bank = process.env.NEXT_PUBLIC_SEPAY_BANK?.trim().toLowerCase();
  let account = process.env.NEXT_PUBLIC_SEPAY_ACCOUNT?.trim();
  if (connectionId !== null) {
    const { data, error } = await supabase.from('sepay_connections').select('bank, account_number')
      .eq('id', connectionId).eq('webhook_key_hash', secretHash(auth.slice(7))).maybeSingle();
    if (error) return NextResponse.json({ success: false, error: 'database_error' }, { status: 500 });
    if (!data) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    bank = data.bank?.trim().toLowerCase(); account = data.account_number;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: true, ok: true, skipped: 'bad_json' });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ success: true, ok: true, skipped: 'invalid_payload' });
  }
  if ('transferType' in raw && raw.transferType === 'out') {
    return NextResponse.json({ success: true, ok: true, skipped: 'not_incoming' });
  }

  const parsed = IncomingTransfer.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: true, ok: true, skipped: 'invalid_payload' });
  }
  const body = parsed.data;
  // Identify the receiver using the authenticated connection, never the booking code.
  if (!bank || !account || /^0+$/.test(account)) {
    return NextResponse.json({ success: true, ok: true, skipped: 'receiver_not_configured' });
  }
  if (body.gateway.toLowerCase() !== bank || body.accountNumber !== account) {
    return NextResponse.json({ success: true, ok: true, skipped: 'wrong_receiver' });
  }

  const amount = body.transferAmount;
  const bankTxId = String(body.id);
  const bookingCodes = extractBookingCodes(body);
  const refCode = bookingCodes[0];

  const subscriptionCodes = extractSubscriptionCodes(body);
  const tournamentCodes = extractTournamentCodes(body);
  const { data, error } = await supabase.rpc('process_incoming_transfer', {
    p_codes: [...bookingCodes, ...subscriptionCodes, ...tournamentCodes],
    p_amount: amount, p_bank_tx_id: bankTxId, p_raw: body,
    p_connection_id: connectionId, p_receiver_bank: body.gateway, p_receiver_account: body.accountNumber,
  });

  if (error) {
    console.error('[sepay] processing failed', error.code ?? 'DATABASE_ERROR');
    return NextResponse.json({ success: false, ok: false, error: 'database_error' }, { status: 500 });
  }

  const result = data as ConfirmPaymentResult;
  console.log('[sepay]', refCode, amount, result.reason);

  // Delivery tasks are committed by SQL with the payment; the scheduler sends them.
  return NextResponse.json({ success: true, ok: true, reason: result.reason });
}

/** SePay ping GET khi bấm "Kiểm tra" trong dashboard. */
export async function GET() {
  return NextResponse.json({ success: true, ok: true, service: 'sepay-webhook' });
}
