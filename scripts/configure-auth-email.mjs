import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

// Mặc định chỉ kiểm tra. --apply cập nhật đúng các trường email, giữ nguyên OAuth.
try {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
    || (await readFile(join(homedir(), '.supabase/access-token'), 'utf8')).trim();
  const ref = process.env.SUPABASE_PROJECT_REF?.trim()
    || new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  if (!/^[a-z]{20}$/.test(ref)) throw new Error('SUPABASE_PROJECT_REF không hợp lệ.');
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const template = await readFile(new URL('../supabase/templates/confirmation.html', import.meta.url), 'utf8');
  const expected = {
    mailer_autoconfirm: false,
    external_email_enabled: true,
    mailer_otp_length: 6,
    mailer_otp_exp: 600,
    smtp_max_frequency: 60,
    mailer_subjects_confirmation: 'Mã xác nhận tài khoản · Sân Ngon',
    mailer_templates_confirmation_content: template,
  };
  let response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Đọc Supabase thất bại (HTTP ${response.status}).`);
  let config = await response.json();

  if (process.argv.includes('--apply')) {
    const patch = { ...expected };
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key && !config.smtp_host) {
      throw new Error('Cần cấu hình SMTP trước: Supabase không cho sửa mẫu thư trên gói Free với bộ gửi mặc định. Thêm RESEND_API_KEY và EMAIL_FROM thuộc tên miền đã xác minh vào .env.local.');
    }
    if (key) {
      const from = process.env.EMAIL_FROM?.trim() ?? '';
      const email = from.match(/<([^<>]+)>$/)?.[1] ?? from;
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || /@resend\.dev$/i.test(email)) {
        throw new Error('EMAIL_FROM phải thuộc tên miền đã xác minh trên Resend; không dùng onboarding@resend.dev.');
      }
      Object.assign(patch, {
        smtp_host: 'smtp.resend.com', smtp_port: 465, smtp_user: 'resend',
        smtp_pass: key, smtp_admin_email: email, smtp_sender_name: 'Sân Ngon',
        rate_limit_email_sent: 30,
      });
    }
    response = await fetch(url, {
      method: 'PATCH', headers, body: JSON.stringify(patch), signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Cập nhật Supabase thất bại (HTTP ${response.status}).`);
    console.log('Đã cập nhật mẫu thư, OTP 6 số, hạn 10 phút' + (key ? ' và SMTP Resend.' : '.'));
    response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Đọc Supabase thất bại (HTTP ${response.status}).`);
    config = await response.json();
  }

  const mismatched = Object.keys(expected).filter((key) => config[key] !== expected[key]);
  if (mismatched.length) console.error(`Cấu hình chưa khớp: ${mismatched.join(', ')}`);
  else console.log('Mẫu thư và OTP khớp với giao diện.');
  const smtpReady = Boolean(config.smtp_host && config.smtp_user && config.smtp_admin_email)
    && !/@resend\.dev$/i.test(config.smtp_admin_email);
  console.log(smtpReady ? 'Đã cấu hình SMTP riêng; cần gửi thử để xác nhận nhận thư.' : 'Chưa có SMTP với tên miền gửi riêng. Cần RESEND_API_KEY và EMAIL_FROM đã xác minh.');
  console.log(`Giới hạn gửi: ${config.rate_limit_email_sent} email/giờ.`);
  process.exitCode = mismatched.length || !smtpReady ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Không kiểm tra được cấu hình email.');
  process.exitCode = 1;
}
