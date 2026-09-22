import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { venueReviewErrorMessage } from '@/lib/venue-review';

export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('status', [
  z.object({ status: z.literal('active') }),
  z.object({
    status: z.literal('rejected'),
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
      { error: parsed.success ? 'Cụm sân không hợp lệ.' : parsed.error.issues[0]?.message ?? 'Thông tin không hợp lệ.' },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc('review_venue', {
    p_venue_id: id,
    p_status: parsed.data.status,
    p_reason: parsed.data.status === 'rejected' ? parsed.data.reason : null,
  });
  if (error) {
    return NextResponse.json(
      { error: venueReviewErrorMessage(error.message) },
      { status: error.message.includes('VENUE_NOT_FOUND') ? 404 : 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
