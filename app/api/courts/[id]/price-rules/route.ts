import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { priceRuleErrorMessage } from '@/lib/price-rules';

export const dynamic = 'force-dynamic';

const Rule = z.object({
  label: z.string().trim().min(1, 'Mỗi khung giá cần một cái tên.').max(60),
  days: z.array(z.number().int().min(0).max(6)).min(1, 'Chọn ít nhất một ngày.').max(7),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  price_per_hour: z.number().int().min(1000).max(10_000_000),
});

const Body = z.object({ rules: z.array(Rule).max(12) });

/**
 * Thay toàn bộ khung giá đặc biệt của một sân con.
 *
 * Không kiểm quyền ở đây: set_court_price_rules() chỉ tìm sân trong cụm của
 * auth.uid() và ném COURT_NOT_FOUND nếu không phải sân của người gọi. Một chỗ
 * kiểm, và chỗ đó là Postgres.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Thông tin sân con không hợp lệ.' }, { status: 400 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu bảng giá không hợp lệ.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để sửa bảng giá.' }, { status: 401 });

  const { data, error } = await supabase.rpc('set_court_price_rules', {
    p_court_id: id,
    p_rules: parsed.data.rules,
  });
  if (error) {
    return NextResponse.json(
      { error: priceRuleErrorMessage(error.message) },
      { status: error.message.includes('COURT_NOT_FOUND') ? 404 : 409 }
    );
  }
  return NextResponse.json({ rules: data });
}
