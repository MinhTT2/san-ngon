import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const payment = ['SUPABASE_SERVICE_ROLE_KEY', 'SEPAY_WEBHOOK_API_KEY', 'NEXT_PUBLIC_SEPAY_ACCOUNT', 'NEXT_PUBLIC_SEPAY_BANK', 'NEXT_PUBLIC_SEPAY_ACCOUNT_NAME'];
const present = (name) => Boolean(process.env[name]?.trim());
const missing = required.filter((name) => !present(name));
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try { const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); if (u.protocol !== 'https:' || u.hostname === 'xxxx.supabase.co') missing.push('NEXT_PUBLIC_SUPABASE_URL (không hợp lệ)'); }
  catch { missing.push('NEXT_PUBLIC_SUPABASE_URL (không hợp lệ)'); }
}
if (missing.length) console.error(`Chưa chạy được app: ${missing.join(', ')}`); else console.log('Đủ cấu hình Supabase cho app.');
const missingPayment = payment.filter((name) => !present(name));
if (missingPayment.length) console.log(`Thanh toán chưa sẵn sàng: ${missingPayment.join(', ')}`);
const account = process.env.NEXT_PUBLIC_SEPAY_ACCOUNT?.trim();
if (account && (!/^\d{6,30}$/.test(account) || /^0+$/.test(account))) {
  console.error('NEXT_PUBLIC_SEPAY_ACCOUNT phải là số tài khoản nhận cọc thật, gồm 6–30 chữ số.');
  missing.push('NEXT_PUBLIC_SEPAY_ACCOUNT (không hợp lệ)');
}
console.log('Demo chỉ nhận đơn cho một chủ sân trong booking_operator; đối chiếu ngân hàng, số tài khoản và tên người nhận trước khi nhận tiền thật.');
console.log('NEXT_PUBLIC_SEPAY_BANK phải khớp gateway trong payload SePay. OAuth nhiều chủ sân chỉ triển khai sau khi SePay duyệt ứng dụng.');
const telegram = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET'];
const missingTelegram = telegram.filter((name) => !present(name));
if (missingTelegram.length) console.log(`Telegram chưa sẵn sàng: ${missingTelegram.join(', ')}`);
const missingEmail = ['RESEND_API_KEY', 'EMAIL_FROM'].filter((name) => !present(name));
if (missingEmail.length) console.log(`Email chủ sân chưa sẵn sàng: ${missingEmail.join(', ')}`);
else if (/@resend\.dev\b/i.test(process.env.EMAIL_FROM)) console.log('EMAIL_FROM đang dùng địa chỉ thử của Resend; cần tên miền đã xác minh để gửi cho chủ sân.');
console.log('Email OTP dùng SMTP riêng trong Supabase: node scripts/configure-auth-email.mjs');
console.log('NEXT_PUBLIC_SITE_URL: production phải dùng domain thật.');
process.exitCode = missing.length ? 1 : 0;
