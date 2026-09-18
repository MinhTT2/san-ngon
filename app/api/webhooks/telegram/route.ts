import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendTelegram } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
  };
};

/** Nhận /start từ Telegram và đổi mã ngắn hạn thành chat_id trong Postgres. */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as TelegramUpdate | null;
  const message = body?.message;
  const chatId = message?.chat?.id;
  const text = message?.text ?? '';
  if (chatId === undefined || message?.chat?.type !== 'private') {
    return NextResponse.json({ ok: true, skipped: 'not_private_message' });
  }

  const match = text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]+))?$/);
  if (!match) return NextResponse.json({ ok: true, skipped: 'not_start' });

  const chat = String(chatId);
  const token = match[1];
  if (!token) {
    await sendTelegram(chat, 'Mở link kết nối từ trang quản lý Sân Ngon để liên kết tài khoản này.');
    return NextResponse.json({ ok: true, linked: false });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc('connect_telegram', {
    p_token: token,
    p_chat_id: chat,
  });

  if (error) {
    console.error('[telegram] connect_telegram lỗi', error.message);
    return NextResponse.json({ error: 'database_error' }, { status: 500 });
  }

  if (data === true) {
    await sendTelegram(chat, 'Đã kết nối Telegram với Sân Ngon. Từ giờ bạn sẽ nhận báo đơn mới tại đây.');
  } else {
    await sendTelegram(chat, 'Link kết nối đã hết hạn hoặc đã được dùng. Hãy tạo link mới trong trang Chủ sân.');
  }

  return NextResponse.json({ ok: true, linked: data === true });
}
