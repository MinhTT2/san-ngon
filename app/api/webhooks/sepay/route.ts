import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractRefCode } from '@/lib/sepay';
import { sendTelegram, ownerBookingMessage } from '@/lib/notify';
import type { ConfirmPaymentResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IncomingTransfer = z.object({
  id: z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d*$/)]),
  gateway: z.string().trim().min(1),
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
  const expected = `Apikey ${process.env.SEPAY_WEBHOOK_API_KEY}`;
  if (!process.env.SEPAY_WEBHOOK_API_KEY || auth !== expected) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
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
  // Only the configured receiver can confirm a deposit in the single-owner demo.
  const bank = process.env.NEXT_PUBLIC_SEPAY_BANK?.trim().toLowerCase();
  const account = process.env.NEXT_PUBLIC_SEPAY_ACCOUNT?.trim();
  if (!bank || !account || /^0+$/.test(account)) {
    return NextResponse.json({ success: true, ok: true, skipped: 'receiver_not_configured' });
  }
  if (body.gateway.toLowerCase() !== bank || body.accountNumber !== account) {
    return NextResponse.json({ success: true, ok: true, skipped: 'wrong_receiver' });
  }

  const amount = body.transferAmount;
  const bankTxId = String(body.id);
  const refCode = extractRefCode(body);

  if (!refCode) {
    return NextResponse.json({ success: true, ok: true, skipped: 'no_ref_code' });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('confirm_payment', {
    p_ref_code: refCode,
    p_amount: amount,
    p_bank_tx_id: bankTxId,
    p_raw: body,
  });

  if (error) {
    console.error('[sepay] confirm_payment lỗi', refCode, error.message);
    return NextResponse.json({ success: false, ok: false, error: error.message }, { status: 500 });
  }

  const result = data as ConfirmPaymentResult;
  console.log('[sepay]', refCode, amount, result.reason);

  // Báo chủ sân. Gửi hỏng cũng không ảnh hưởng: tiền đã vào, đơn đã xác nhận.
  if (result.ok && result.reason === 'CONFIRMED') {
    const sent = await sendTelegram(result.owner_telegram_chat_id, ownerBookingMessage(result));
    // notifications.user_id là NOT NULL — phải ghi đúng chủ sân, nếu không dòng
    // báo-lỗi-gửi-tin bị chặn và không ai biết Telegram đã hỏng.
    //
    // NOT_CONFIGURED nghĩa là chủ sân chưa nối Telegram bao giờ, không phải
    // gửi hỏng. Ghi cả trường hợp đó thì mỗi đơn đẻ thêm một dòng cảnh báo vô
    // nghĩa, lấp mất những lần hỏng thật.
    if (!sent.ok && sent.reason !== 'NOT_CONFIGURED' && result.owner_id) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: result.owner_id,
        booking_id: result.booking_id ?? null,
        kind: 'new_booking',
        channel: 'telegram',
        title: `Không gửi được Telegram cho đơn ${result.code}`,
        body: sent.reason,
        failed_reason: sent.reason,
      });
      if (notifError) console.error('[sepay] không ghi được notification', notifError.message);
    }
  }

  return NextResponse.json({ success: true, ok: true, result });
}

/** SePay ping GET khi bấm "Kiểm tra" trong dashboard. */
export async function GET() {
  return NextResponse.json({ success: true, ok: true, service: 'sepay-webhook' });
}
