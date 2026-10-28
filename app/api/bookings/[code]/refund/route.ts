import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { refundError } from '@/lib/booking-refunds';

export const dynamic = 'force-dynamic';

const codeSchema = z.string().regex(/^SAN[A-HJ-NP-Z2-9]{6}$/);
const schema = z.object({
  id: z.guid(), amount: z.number().int().positive().max(2147483647),
  reference: z.string().trim().min(3).max(200),
  transferred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!codeSchema.safeParse(code).success) return NextResponse.json({ error: 'Mã đơn không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { data, error } = await supabase.rpc('get_booking_refund', { p_code: code });
  if (error) { const failure = refundError(error.message); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
  return NextResponse.json({ refund: data }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** Records a completed manual transfer; PostgreSQL owns the balance and authorization. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!codeSchema.safeParse(code).success || !parsed.success) return NextResponse.json({ error: 'Nhập đủ số tiền, mã tham chiếu và thời gian chuyển hoàn.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { data, error } = await supabase.rpc('record_booking_refund', {
    p_code: code, p_id: parsed.data.id, p_amount: parsed.data.amount,
    p_reference: parsed.data.reference, p_transferred_at: parsed.data.transferred_at,
  });
  if (error) { const failure = refundError(error.message); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
  return NextResponse.json({ refund: data });
}
