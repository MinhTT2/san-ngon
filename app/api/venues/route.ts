import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { venueErrorMessage } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(3).max(120),
  address: z.string().trim().min(3).max(200),
  district: z.string().trim().min(2).max(60),
  phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0'),
  description: z.string().trim().max(500).optional(),
  open_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ mở cửa không hợp lệ'),
  close_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ đóng cửa không hợp lệ'),
  sports: z.array(z.object({
    sport: z.enum(['football5', 'football7', 'football11', 'badminton', 'pickleball', 'tennis']),
    court_count: z.number().int().min(1).max(20),
    price_per_hour: z.number().int().min(1000).max(10_000_000),
  })).min(1, 'Chọn ít nhất một môn thể thao.').max(6)
    .superRefine((sports, ctx) => {
      if (new Set(sports.map((item) => item.sport)).size !== sports.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mỗi môn thể thao chỉ chọn một lần.' });
      }
      if (sports.reduce((total, item) => total + item.court_count, 0) > 20) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tổng số sân con không được quá 20 sân.' });
      }
    }),
  payout_bank: z.string().trim().max(60).optional(),
  payout_account: z.string().trim().max(40).optional(),
});

/**
 * Hồ sơ đăng sân. Mọi kiểm tra nghiệp vụ và việc sinh slug nằm trong
 * register_venue() — ở đây chỉ chặn dữ liệu rác và dịch lỗi sang tiếng Việt.
 */
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
    return NextResponse.json({ error: 'Bạn cần đăng nhập để đăng sân.' }, { status: 401 });
  }

  const v = parsed.data;
  const { data, error } = await supabase.rpc('register_venue', {
    p_name: v.name,
    p_address: v.address,
    p_district: v.district,
    p_phone: v.phone,
    p_description: v.description ?? null,
    p_open_time: v.open_time,
    p_close_time: v.close_time,
    p_sports: v.sports,
    p_payout_bank: v.payout_bank ?? null,
    p_payout_account: v.payout_account ?? null,
  }).single();

  if (error) {
    const alreadyExists = error.message.includes('VENUE_EXISTS')
      || error.message.includes('venues_one_per_owner_idx');
    const status = error.message.includes('AUTH_REQUIRED') ? 401
      : alreadyExists ? 409
      : 400;
    return NextResponse.json({ error: venueErrorMessage(alreadyExists ? 'VENUE_EXISTS' : error.message) }, { status });
  }

  return NextResponse.json({ venue: data }, { status: 201 });
}
