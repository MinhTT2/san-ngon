import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminBookingCsv, type AdminBookingExportRow } from '@/lib/admin-booking-csv';

const schema = z.object({
  filter: z.enum(['upcoming', 'pending', 'refund', 'history', 'all']).default('upcoming'),
  q: z.string().trim().max(100).default(''),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Bộ lọc không hợp lệ.' }, { status: 400, headers });
  const { filter, q, from, to } = parsed.data;
  if (from && to && from > to) return NextResponse.json({ error: 'Khoảng ngày không hợp lệ.' }, { status: 400, headers });

  const db = await createClient();
  const { data, error } = await db.rpc('export_admin_bookings', {
    p_filter: filter,
    p_query: q || null,
    p_from: from ?? null,
    p_to: to ?? null,
  });
  if (error) {
    const message = error.message.includes('EXPORT_TOO_LARGE')
      ? 'Hơn 10.000 đơn. Hãy chọn khoảng ngày hoặc từ khóa ngắn hơn.'
      : error.message.includes('INVALID_DATE_RANGE') ? 'Khoảng ngày không hợp lệ.' : 'Chưa xuất được danh sách đơn. Vui lòng thử lại.';
    return NextResponse.json({ error: message }, { status: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503, headers });
  }
  const result = data as unknown as { rows: AdminBookingExportRow[] };
  const suffix = from || to ? `-${from ?? 'all'}-${to ?? 'all'}` : '';
  return new NextResponse(adminBookingCsv(result.rows), {
    headers: {
      ...headers,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="san-ngon-don-dat${suffix}.csv"`,
    },
  });
}
