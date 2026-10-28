import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const schema = z.object({ note_id: z.guid(), note: z.string().trim().min(10).max(1000), updated_at: z.string().datetime({ offset: true }) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.guid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: 'Nhập ghi chú từ 10 đến 1.000 ký tự và tải lại giao dịch nếu cần.' }, { status: 400, headers });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401, headers });
  const { error } = await db.rpc('note_incoming_transfer', { p_id: id, p_note_id: parsed.data.note_id, p_note: parsed.data.note, p_updated_at: parsed.data.updated_at });
  if (error) {
    const changed = error.message.includes('TRANSFER_CHANGED');
    const missing = error.message.includes('TRANSFER_NOT_FOUND');
    if (error.message.includes('INVALID_NOTE')) return NextResponse.json({ error: 'Ghi chú cần từ 10 đến 1.000 ký tự.' }, { status: 400, headers });
    return NextResponse.json({ error: changed ? 'Giao dịch có thay đổi. Giữ lại ghi chú và tải lại sổ trước khi gửi.' : missing ? 'Không tìm thấy giao dịch trong tài khoản của bạn.' : 'Chưa lưu được ghi chú. Nội dung vẫn được giữ để thử lại.' }, { status: error.code === '42501' ? 403 : missing ? 404 : changed || error.message.includes('NOTE_CONFLICT') ? 409 : 503, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
