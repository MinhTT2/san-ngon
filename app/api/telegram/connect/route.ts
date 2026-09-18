import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TELEGRAM_LINK_MINUTES } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tạo deep link dùng một lần để chủ sân nối tài khoản Telegram của mình. */
export async function POST() {
  const bot = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '').trim();
  if (!bot || !process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Telegram chưa được cấu hình.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });

  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_MINUTES * 60_000).toISOString();

  const { error } = await supabase
    .from('profiles')
    .update({ telegram_link_token_hash: tokenHash, telegram_link_expires_at: expiresAt })
    .eq('id', user.id);

  if (error) {
    console.error('[telegram] không tạo được mã liên kết', error.message);
    return NextResponse.json({ error: 'Không tạo được link. Thử lại sau.' }, { status: 500 });
  }

  return NextResponse.json({
    url: `https://t.me/${bot}?start=${token}`,
    expiresAt,
  });
}
