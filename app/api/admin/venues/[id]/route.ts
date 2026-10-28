import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get('origin') !== requestOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const { id } = await params;
  if (!z.guid().safeParse(id).success) return NextResponse.json({ error: 'Thông tin cụm sân không hợp lệ.' }, { status: 400 });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
  const { data: admin, error: accessError } = await db.rpc('is_admin');
  if (accessError) return NextResponse.json({ error: 'Không kiểm tra được quyền truy cập. Hãy thử lại.' }, { status: 500 });
  if (!admin) return NextResponse.json({ error: 'Chỉ quản trị viên được xóa sân.' }, { status: 403 });
  const { error } = await db.rpc('admin_delete_venue', { p_venue_id: id });
  if (error) {
    const messages: Record<string, string> = {
      FORBIDDEN: 'Chỉ quản trị viên được xóa sân.',
      VENUE_NOT_FOUND: 'Cụm sân đã được xóa hoặc không còn tồn tại. Hãy tải lại trang.',
      VENUE_HAS_BOOKINGS: 'Không thể xóa cụm sân đã có đơn đặt, kể cả đơn đã hủy. Cần giữ lịch sử để đối soát.',
      VENUE_HAS_TOURNAMENTS: 'Cụm sân còn giải đấu liên quan. Hãy xử lý giải trước khi xóa sân.',
    };
    const message = messages[error.message];
    return NextResponse.json({ error: message ?? 'Không xóa được sân. Hãy thử lại.' }, {
      status: error.message === 'FORBIDDEN' ? 403 : error.message === 'VENUE_NOT_FOUND' ? 404 : message ? 409 : 500,
    });
  }
  return new NextResponse(null, { status: 204 });
}
