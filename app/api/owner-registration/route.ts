import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ownerErrorMessage } from '@/lib/constants';

const Body = z.object({
  full_name: z.string().trim().min(2, 'Nhập họ và tên người đại diện.').max(120),
  phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'),
  payout_bank: z.string().trim().min(2, 'Nhập tên ngân hàng.').max(60),
  payout_account: z.string().trim().regex(/^\d{6,30}$/, 'Số tài khoản phải gồm 6 đến 30 chữ số.'),
});

const LICENSE_TYPES = new Map([['application/pdf', 'pdf'], ['image/jpeg', 'jpg'], ['image/png', 'png']]);
const MAX_LICENSE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  let raw: unknown = null;
  try { raw = JSON.parse(String(form?.get('data') ?? '')); } catch { /* zod handles the response */ }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập để đăng ký chủ sân.' }, { status: 401 });
  const license = form?.get('business_license');
  if (!(license instanceof File) || license.size === 0) return NextResponse.json({ error: 'Bạn cần tải lên giấy tờ kinh doanh.' }, { status: 400 });
  const extension = LICENSE_TYPES.get(license.type);
  if (!extension || license.size > MAX_LICENSE_BYTES) return NextResponse.json({ error: 'Giấy tờ phải là PDF, JPG hoặc PNG và không quá 10MB.' }, { status: 400 });

  const licensePath = `${user.id}/${randomUUID()}.${extension}`;
  const storage = supabase.storage.from('venue-documents');
  const { error: uploadError } = await storage.upload(licensePath, license, { contentType: license.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: 'Không tải được giấy tờ. Thử lại sau vài giây.' }, { status: 400 });

  const { error } = await supabase.rpc('register_owner', {
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_business_license_path: licensePath,
    p_business_license_name: license.name,
    p_payout_bank: parsed.data.payout_bank,
    p_payout_account: parsed.data.payout_account,
  });
  if (error) {
    await storage.remove([licensePath]);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 400;
    return NextResponse.json({ error: ownerErrorMessage(error.message) }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
