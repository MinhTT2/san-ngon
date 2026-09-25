import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { courtErrorMessage } from '@/lib/constants';

const PriceBody = z.object({
  id: z.string().uuid().nullable(),
  label: z.string().trim().min(1, 'Nhập tên mức giá.').max(80),
  days: z.array(z.number().int().min(0).max(6)).min(1, 'Chọn ít nhất một ngày.').max(7),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  price_per_hour: z.number().int().min(1000).max(10_000_000),
  priority: z.number().int().min(0).max(100),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin sân không hợp lệ.' }, { status: 400 });
  const parsed = PriceBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Kiểm tra lại bảng giá.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để sửa bảng giá.' }, { status: 401 });
  const rule = parsed.data;
  const { data, error } = await supabase.rpc('save_price_rule', {
    p_court_id: id, p_rule_id: rule.id, p_label: rule.label, p_days: rule.days,
    p_start_time: rule.start_time, p_end_time: rule.end_time,
    p_price_per_hour: rule.price_per_hour, p_priority: rule.priority,
  }).single();
  if (error) return NextResponse.json({ error: courtErrorMessage(error.message) }, { status: 400 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: 'Mức giá không hợp lệ.' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để sửa bảng giá.' }, { status: 401 });
  const { error } = await supabase.rpc('delete_price_rule', { p_court_id: id, p_rule_id: parsed.data.id });
  if (error) return NextResponse.json({ error: courtErrorMessage(error.message) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
