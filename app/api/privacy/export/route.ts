import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401, headers });
  const { data, error } = await db.rpc('get_my_data_export');
  if (error) return NextResponse.json({ error: error.message === 'EXPORT_TOO_LARGE' ? 'Dữ liệu vượt giới hạn xuất nhanh. Gửi yêu cầu để admin hỗ trợ đầy đủ.' : 'Chưa xuất được dữ liệu. Kiểm tra quyền hoặc thử lại.' }, { status: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503, headers });
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="san-ngon-du-lieu-cua-toi.json"' } });
}
