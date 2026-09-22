import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.'),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ bắt đầu không hợp lệ.').nullable().optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ kết thúc không hợp lệ.').nullable().optional(),
  reason: z.string().trim().max(200, 'Lý do không quá 200 ký tự.').nullable().optional(),
});

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin sân không hợp lệ.' }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { supabase, user } = await owner();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để khóa lịch.' }, { status: 401 });
  const { data, error } = await supabase.rpc('close_court', {
    p_court_id: id, p_date: parsed.data.date, p_start_time: parsed.data.start_time ?? null,
    p_end_time: parsed.data.end_time ?? null, p_reason: parsed.data.reason ?? null,
  });
  if (error) return NextResponse.json({ error: closeError(error.message) }, { status: 400 });
  return NextResponse.json({ id: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin sân không hợp lệ.' }, { status: 400 });
  const closureId = new URL(request.url).searchParams.get('closure');
  if (!z.string().uuid().safeParse(closureId).success) return NextResponse.json({ error: 'Thông tin ngày nghỉ không hợp lệ.' }, { status: 400 });
  const { supabase, user } = await owner();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để mở lại lịch.' }, { status: 401 });
  const { error } = await supabase.rpc('reopen_court', { p_court_id: id, p_closure_id: closureId });
  if (error) return NextResponse.json({ error: closeError(error.message) }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}

function closeError(raw: string) {
  if (raw.includes('CLOSURE_HAS_BOOKINGS')) return 'Khoảng giờ này đã có đơn. Hãy xử lý đơn trước khi báo nghỉ.';
  if (raw.includes('CLOSURE_OVERLAP')) return 'Khoảng giờ này đã được khóa trước đó.';
  if (raw.includes('CLOSURE_DATE_INVALID')) return 'Chỉ được khóa từ hôm nay đến 365 ngày tới.';
  if (raw.includes('INVALID_HOURS')) return 'Nhập đủ giờ bắt đầu và kết thúc, giờ kết thúc phải sau giờ bắt đầu.';
  if (raw.includes('CLOSURE_REASON_LONG')) return 'Lý do không quá 200 ký tự.';
  if (raw.includes('COURT_NOT_FOUND')) return 'Không tìm thấy sân.';
  return 'Không lưu được thay đổi lịch sân.';
}
