import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { cashReportCsv, type CashReport } from '@/lib/cash-report';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const parsed = z.object({ from: z.string().date(), to: z.string().date() }).safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Chọn hai ngày hợp lệ.' }, { status: 400, headers });
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401, headers });
  const { data, error } = await db.rpc('get_cash_report', { p_from: parsed.data.from, p_to: parsed.data.to, p_export: true });
  if (error) return NextResponse.json({ error: error.message === 'EXPORT_TOO_LARGE' ? 'Hơn 5.000 dòng. Chọn khoảng ngắn hơn.' : error.message === 'INVALID_DATE_RANGE' ? 'Chọn khoảng không quá 93 ngày.' : 'Chưa xuất được báo cáo. Kiểm tra quyền hoặc thử lại.' }, { status: error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503, headers });
  return new NextResponse(cashReportCsv(data as unknown as CashReport), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="san-ngon-tien-${parsed.data.from}-${parsed.data.to}.csv"` } });
}
