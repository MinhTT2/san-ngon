import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ownerApplicationEmail, sendEmail } from '@/lib/notify';
import { OWNER_REVIEW_ERRORS } from '@/lib/owner-review';

const Body = z.discriminatedUnion('status', [
  z.object({ status: z.literal('active') }),
  z.object({
    status: z.literal('rejected'),
    // Lý do là bắt buộc ở cả đây lẫn trong review_owner(). Ở đây để báo lỗi
    // tiếng Việt tử tế; ở đó để người gọi thẳng RPC cũng không bỏ qua được.
    reason: z.string().trim().min(5, 'Lý do quá ngắn — chủ sân cần biết phải sửa gì.').max(500),
  }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: parsed.success ? 'Hồ sơ không hợp lệ.' : parsed.error.issues[0]?.message ?? 'Thông tin duyệt hồ sơ không hợp lệ.' },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc('review_owner', {
    p_owner_id: id,
    p_status: parsed.data.status,
    p_reason: parsed.data.status === 'rejected' ? parsed.data.reason : null,
  });
  if (error) {
    const key = Object.keys(OWNER_REVIEW_ERRORS).find((item) => error.message.includes(item));
    return NextResponse.json(
      { error: key ? OWNER_REVIEW_ERRORS[key] : 'Không lưu được kết quả duyệt. Hãy thử lại.' },
      { status: key ? 409 : 500 }
    );
  }

  const { data: ownerEmail, error: emailLookupError } = await supabase.rpc('get_owner_email', { p_owner_id: id });
  if (emailLookupError) console.error('[owner-review] không lấy được email chủ sân', emailLookupError.message);
  let emailSent = false;
  if (ownerEmail) {
    const message = ownerApplicationEmail(
      parsed.data.status,
      parsed.data.status === 'rejected' ? parsed.data.reason : undefined
    );
    const email = await sendEmail(ownerEmail, message.subject, message.html);
    emailSent = email.ok;
    if (!email.ok && email.reason !== 'NOT_CONFIGURED') console.error('[owner-review] không gửi được email', email.reason);
  }
  return NextResponse.json({ ok: true, emailSent });
}
