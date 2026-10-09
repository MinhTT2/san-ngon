import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ownerErrorMessage } from '@/lib/constants';

const Body = z.object({
  full_name: z.string().trim().min(2, 'Nhập họ và tên người đại diện.').max(120),
  phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'),
  reuse_document: z.boolean().optional(),
  payout_bank: z.string().trim().min(2, 'Nhập tên ngân hàng.').max(60).optional(),
  payout_account: z.string().trim().regex(/^\d{6,30}$/, 'Số tài khoản phải gồm 6 đến 30 chữ số.').optional(),
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
  const storage = supabase.storage.from('venue-documents');
  let licensePath: string;
  let licenseName: string;
  let uploaded = false;
  if (license instanceof File && license.size > 0) {
    const extension = LICENSE_TYPES.get(license.type);
    if (!extension || license.size > MAX_LICENSE_BYTES) return NextResponse.json({ error: 'Giấy tờ phải là PDF, JPG hoặc PNG và không quá 10MB.' }, { status: 400 });
    licensePath = `${user.id}/${randomUUID()}.${extension}`;
    licenseName = license.name;
    const { error: uploadError } = await storage.upload(licensePath, license, { contentType: license.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: 'Không tải được giấy tờ. Thử lại sau vài giây.' }, { status: 400 });
    uploaded = true;
  } else if (parsed.data.reuse_document) {
    // The browser never chooses a path. Reuse only this user's rejected application.
    const { data: previous, error } = await supabase.from('profiles').select('owner_application_status, business_license_path, business_license_name').eq('id', user.id).single();
    if (error) return NextResponse.json({ error: 'Chưa kiểm tra được giấy tờ đã gửi. Hãy thử lại.' }, { status: 503 });
    if (previous.owner_application_status !== 'rejected' || !previous.business_license_path || !previous.business_license_name) return NextResponse.json({ error: 'Không có giấy tờ phù hợp để dùng lại. Hãy chọn tệp.' }, { status: 400 });
    licensePath = previous.business_license_path;
    licenseName = previous.business_license_name;
  } else return NextResponse.json({ error: 'Bạn cần tải lên giấy tờ kinh doanh.' }, { status: 400 });

  const { error } = await supabase.rpc('register_owner', {
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_business_license_path: licensePath,
    p_business_license_name: licenseName,
    p_payout_bank: parsed.data.payout_bank ?? null,
    p_payout_account: parsed.data.payout_account ?? null,
  });
  if (error) {
    if (uploaded) await storage.remove([licensePath]);
    const status = error.message.includes('AUTH_REQUIRED') ? 401 : 400;
    return NextResponse.json({ error: ownerErrorMessage(error.message) }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
