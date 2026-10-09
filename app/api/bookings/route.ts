import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { BOOKING_ERRORS, bookingErrorMessage } from '@/lib/constants';
import type { Database } from '@/lib/database.types';
import { normalizePhone } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/**
 * offset: true là bắt buộc, không phải tuỳ chọn.
 *
 * Giờ trong body đi thẳng từ get_venue_availability ra, mà PostgREST tuần tự
 * hoá timestamptz thành "2026-09-18T11:00:00+00:00". z.string().datetime()
 * mặc định chỉ nhận hậu tố "Z", nên mọi đơn đều bị chặn ở đây với thông báo
 * "Invalid datetime" — không ai đặt được sân.
 */
const Body = z.object({
  request_id: z.string().uuid('Thông tin lần đặt không hợp lệ.').optional(),
  request_user_id: z.string().uuid('Thông tin tài khoản không hợp lệ.').optional(),
  court_id: z.string().uuid('Thông tin sân không hợp lệ.'),
  starts_at: z.string().datetime({ offset: true, message: 'Giờ bắt đầu không hợp lệ.' }),
  ends_at: z.string().datetime({ offset: true, message: 'Giờ kết thúc không hợp lệ.' }),
  customer_name: z.string().trim().max(100, 'Tên người đặt không quá 100 ký tự.').optional(),
  customer_phone: z.string().max(30, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0').transform(normalizePhone).pipe(z.string().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0')),
  note: z.string().trim().max(500, 'Ghi chú không quá 500 ký tự.').optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập để đặt sân.' }, { status: 401 });
  }

  const b = parsed.data;
  if (b.request_user_id && b.request_user_id !== user.id) {
    return NextResponse.json({ error: 'Tài khoản đăng nhập đã thay đổi. Đăng nhập lại tài khoản đã đặt sân để tiếp tục.' }, { status: 401 });
  }
  // Giá KHÔNG nhận từ client. create_booking tự tra price_rules và tính lại.
  const args = {
    p_court_id: b.court_id,
    p_starts_at: b.starts_at,
    p_ends_at: b.ends_at,
    p_customer_name: b.customer_name ?? null,
    p_customer_phone: b.customer_phone,
    p_note: b.note ?? null,
  };
  const { data, error } = await (b.request_id
    ? supabase.rpc('create_booking_once', { ...args, p_request_id: b.request_id })
    : supabase.rpc('create_booking', args)).single<Database['public']['Tables']['bookings']['Row']>();

  if (error) {
    const known = Object.keys(BOOKING_ERRORS).some(code => error.message.includes(code));
    const status = error.message.includes('SLOT_TAKEN') || error.message.includes('REQUEST_CONFLICT') ? 409
      : error.message.includes('AUTH_REQUIRED') ? 401
      : error.message.includes('ACCOUNT_BANNED') ? 403
      : known ? 400 : 503;
    return NextResponse.json({ request_conflict: error.message.includes('REQUEST_CONFLICT'), error: status === 503 ? 'Chưa nhận được kết quả tạo đơn. Kiểm tra Đơn của tôi để tiếp tục lần đặt này.' : bookingErrorMessage(error.message) }, { status });
  }

  if (!data?.id || !/^SAN[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(data.code ?? '')) {
    return NextResponse.json({ error: 'Chưa nhận được kết quả tạo đơn. Kiểm tra Đơn của tôi để tiếp tục lần đặt này.' }, { status: 503 });
  }
  return NextResponse.json({ booking: data }, { status: 201 });
}
