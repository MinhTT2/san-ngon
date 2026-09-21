import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ status: z.enum(['active', 'rejected']) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin duyệt hồ sơ không hợp lệ.' }, { status: 400 });
  const { error } = await supabase.rpc('review_owner', { p_owner_id: id, p_status: parsed.data.status });
  if (error) {
    const messages: Record<string, string> = { OWNER_NOT_FOUND: 'Không tìm thấy hồ sơ chủ sân.', OWNER_ALREADY_REVIEWED: 'Hồ sơ đã được xử lý. Hãy tải lại trang.', REPRESENTATIVE_REQUIRED: 'Hồ sơ thiếu họ tên hoặc số điện thoại.', BUSINESS_LICENSE_MISSING: 'Hồ sơ thiếu giấy tờ kinh doanh.', PAYOUT_REQUIRED: 'Chủ sân chưa bổ sung tài khoản nhận tiền.' };
    const key = Object.keys(messages).find((item) => error.message.includes(item));
    return NextResponse.json({ error: key ? messages[key] : 'Không lưu được kết quả duyệt. Hãy thử lại.' }, { status: key ? 409 : 500 });
  }
  return NextResponse.json({ ok: true });
}
