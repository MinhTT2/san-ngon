import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';

const schema = z.object({ venue_id: z.string().uuid(), saved: z.boolean() });
export async function POST(request: Request) {
  if (request.headers.get('origin') !== requestOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để lưu sân.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Thông tin sân chưa hợp lệ.' }, { status: 400 });
  const { data, error } = await db.rpc('set_venue_favorite', { p_venue_id: parsed.data.venue_id, p_saved: parsed.data.saved });
  if (error) return NextResponse.json({ error: error.message === 'FAVORITES_LIMIT' ? 'Bạn đã lưu 100 sân. Bỏ lưu một sân trước khi thêm.' : error.message === 'VENUE_UNAVAILABLE' ? 'Sân hiện chưa công khai. Bạn vẫn có thể bỏ lưu sân trong danh sách yêu thích.' : 'Chưa cập nhật được sân yêu thích. Vui lòng thử lại.' }, { status: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500 });
  return NextResponse.json({ saved: data });
}
