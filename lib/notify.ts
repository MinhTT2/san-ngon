import { vnd } from './format';
import type { ConfirmPaymentResult } from './types';

/**
 * Hai kênh chạm ra ngoài hệ thống. Thông báo trong app do Postgres ghi thẳng
 * vào bảng notifications trong confirm_payment, không đi qua đây.
 *
 * Cả hai hàm dưới đây KHÔNG BAO GIỜ ném lỗi. Gửi hỏng thì ghi log rồi đi tiếp:
 * tiền đã vào tài khoản, đơn đã xác nhận, không được để việc gửi tin làm hỏng webhook.
 */

/** Telegram — kênh duy nhất chạm được chủ sân lúc họ đang ở ngoài sân. */
export async function sendTelegram(chatId: string | null | undefined, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { ok: false, reason: 'NOT_CONFIGURED' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      console.error('[telegram] gửi hỏng', res.status, await res.text());
      return { ok: false, reason: `HTTP_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[telegram] lỗi mạng', e);
    return { ok: false, reason: 'NETWORK' };
  }
}

/**
 * Email — Should, không phải Must. Bản MVP cắt email cho người chơi để lấy 1 ngày.
 * Hàm để sẵn, bật lại khi có thời gian.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'NOT_CONFIGURED' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error('[email] gửi hỏng', res.status, await res.text());
      return { ok: false, reason: `HTTP_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] lỗi mạng', e);
    return { ok: false, reason: 'NETWORK' };
  }
}

/** Tin nhắn báo đơn mới gửi cho chủ sân. Giữ ngắn, họ đọc trên sân. */
export function ownerBookingMessage(r: ConfirmPaymentResult) {
  const start = r.starts_at
    ? new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(r.starts_at))
    : '';

  return [
    `<b>Đơn mới ${r.code}</b>`,
    `${r.venue_name} — ${r.court_name}`,
    start,
    `${r.customer_name ?? 'Khách'} · ${r.customer_phone}`,
    `Đã cọc ${vnd(r.deposit_amount ?? 0)} · thu tại sân ${vnd((r.total_amount ?? 0) - (r.deposit_amount ?? 0))}`,
  ].join('\n');
}
