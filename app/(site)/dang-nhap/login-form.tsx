'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** ?loi=1 là do /auth/callback đá về. */
const CALLBACK_ERROR =
  'Mã xác thực không dùng được nữa. Bạn hãy đăng nhập lại hoặc đăng ký lại nhé.';

/**
 * Supabase trả lỗi tiếng Anh. Ba lỗi hay gặp nhất dịch sẵn, phần còn lại giữ
 * nguyên để còn tra được.
 */
function viError(raw: string) {
  const s = raw.toLowerCase();
  if (s.includes('provider is not enabled') || s.includes('unsupported provider')) {
    return 'Đăng nhập Google chưa được bật. Dùng email phía dưới giúp bạn nhé.';
  }
  if (s.includes('rate limit') || s.includes('too many requests')) {
    return 'Gửi quá nhiều lần rồi. Đợi ít phút rồi thử lại.';
  }
  if (s.includes('invalid login credentials')) return 'Email hoặc mật khẩu chưa đúng.';
  if (s.includes('email not confirmed')) return 'Bạn chưa xác nhận email. Nhập mã OTP trong email rồi thử lại.';
  if (s.includes('user already registered')) return 'Email này đã có tài khoản. Hãy đăng nhập.';
  if (s.includes('password should be at least')) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (s.includes('invalid email')) return 'Email không hợp lệ.';
  return raw;
}

export function LoginForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const hasBookingDraft = next.includes('/san/');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(params.get('loi') ? CALLBACK_ERROR : null);

  // Thiếu NEXT_PUBLIC_SITE_URL thì chuỗi ra "undefined/auth/callback" và cả
  // hai cách đăng nhập đều hỏng mà không báo gì. Lấy origin của trình duyệt
  // làm phương án dự phòng — trên bản preview của Vercel cũng đúng luôn.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window === 'undefined' ? '' : window.location.origin);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // Khi người dùng vừa chọn giờ rồi mới đăng nhập, điền lại thông tin họ đã
  // nhập ở form đặt sân để không bắt họ gõ lần hai.
  useEffect(() => {
    if (!signup) return;
    try {
      const raw = sessionStorage.getItem('san-ngon:booking-draft');
      if (!raw) return;
      const draft = JSON.parse(raw) as { name?: string; phone?: string };
      if (draft.name) setName(draft.name);
      if (draft.phone) setPhone(draft.phone);
    } catch {
      // Draft chỉ là tiện ích UX, hỏng thì form vẫn dùng bình thường.
    }
  }, [signup]);

  /**
   * signInWithOAuth KHÔNG gọi mạng: nó dựng URL ở phía client rồi gán thẳng
   * window.location.href (GoTrueClient._handleProviderSignIn). Provider chưa
   * bật thì trình duyệt đã rời trang, Supabase trả JSON thô ra màn hình và
   * nhánh `error` của hàm này không bao giờ chạy.
   *
   * Nên phải tự thăm dò URL trước. Thăm dò hỏng vì mạng hay CORS thì cứ
   * chuyển trang như cũ — không để việc kiểm tra làm hỏng đường đăng nhập.
   */
  async function google() {
    setBusy('google');
    setError(null);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data?.url) {
      setError(viError(error?.message ?? 'Không mở được đăng nhập Google.'));
      setBusy(null);
      return;
    }

    try {
      // redirect: 'manual' — provider bật thì GoTrue trả 302 sang Google và
      // trình duyệt đưa về response rỗng kiểu opaqueredirect.
      const probe = await fetch(data.url, { method: 'GET', redirect: 'manual' });
      if (probe.type !== 'opaqueredirect' && probe.status >= 400) {
        const body = await probe.json().catch(() => null);
        setError(viError(body?.msg ?? body?.error_description ?? 'Đăng nhập Google chưa dùng được.'));
        setBusy(null);
        return;
      }
    } catch {
      // Không thăm dò được — đi tiếp bằng đường cũ.
    }

    window.location.href = data.url;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy('email');
    setError(null);
    if (signup) {
      if (password.length < 8) {
        setBusy(null);
        setError('Mật khẩu cần ít nhất 8 ký tự.');
        return;
      }
      if (password !== passwordAgain) {
        setBusy(null);
        setError('Mật khẩu nhập lại chưa khớp.');
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...(name.trim() ? { full_name: name.trim() } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          },
        },
      });
      setBusy(null);
      if (error) {
        setError(viError(error.message));
      } else if (data.session) {
        router.push(next);
        router.refresh();
      } else {
        setSent(true);
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) setError(viError(error.message));
    else if (data.session) {
      router.push(next);
      router.refresh();
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy('email');
    setError(null);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    setBusy(null);
    if (error) {
      setError(viError(error.message));
      return;
    }
    if (data.session) {
      router.push(next);
      router.refresh();
    }
  }

  async function resend() {
    setBusy('email');
    setError(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setBusy(null);
    if (error) setError(viError(error.message));
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-control border border-strong bg-free-fill p-6">
        <Envelope />
        <div className="flex flex-col gap-2">
          <p className="text-[17px] font-semibold text-pitch">Nhập mã OTP</p>
          <p className="text-[15px] leading-relaxed">
            Đã gửi mã xác nhận 6 số tới <strong className="break-all">{email}</strong>.
          </p>
          <p className="text-[13px] leading-relaxed text-[#2C4A3C]">
            Không thấy sau một phút thì xem thư mục spam. Mã chỉ dùng một lần.
          </p>
        </div>
        {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3.5 text-sm leading-relaxed text-danger">{error}</p>}
        <form onSubmit={verify} className="flex flex-col gap-2.5">
          <label htmlFor="token" className="text-sm font-semibold">Mã OTP</label>
          <input id="token" type="text" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="h-13 rounded-control border border-hairline bg-page px-4 text-center text-xl tracking-[0.35em] focus:border-pitch focus:outline-none" />
          <button type="submit" disabled={busy !== null} className="h-13 rounded-control bg-pitch text-base font-semibold text-pitch-ink disabled:opacity-60">{busy === 'email' ? 'Đang xác nhận…' : 'Xác nhận tài khoản'}</button>
        </form>
        <div className="flex gap-4 text-sm">
          <button type="button" onClick={resend} disabled={busy !== null} className="font-semibold text-pitch underline underline-offset-2 disabled:opacity-60">Gửi lại mã</button>
          <button type="button" onClick={() => { setSent(false); setError(null); setToken(''); }} className="font-semibold text-pitch underline underline-offset-2">Đổi email</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3.5 text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}

      {!signup && (
        <>
          <button
            type="button"
            onClick={google}
            disabled={busy !== null}
            className="flex h-13 items-center justify-center gap-3 rounded-control border border-hairline bg-card text-base font-semibold transition-colors hover:border-strong disabled:opacity-60"
          >
            <GoogleMark />
            {busy === 'google' ? 'Đang chuyển sang Google…' : 'Tiếp tục với Google'}
          </button>

          <div className="flex items-center gap-3 text-xs text-ink-secondary">
            <span className="h-px flex-grow bg-hairline" />
            hoặc dùng email
            <span className="h-px flex-grow bg-hairline" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        {signup && (
          <>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold">
                Tên của bạn
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="h-13 w-full min-w-0 rounded-control border border-hairline bg-page px-4 text-base font-normal focus:border-pitch focus:outline-none"
                />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold">
                Số điện thoại
                <input
                  id="phone"
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="0\d{9}"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="h-13 w-full min-w-0 rounded-control border border-hairline bg-page px-4 text-base font-normal focus:border-pitch focus:outline-none"
                />
              </label>
            </div>
          </>
        )}
        <label htmlFor="email" className="text-sm font-semibold">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@example.com"
          className="h-13 rounded-control border border-hairline bg-page px-4 text-base focus:border-pitch focus:outline-none"
        />
        <label htmlFor="password" className="text-sm font-semibold">Mật khẩu</label>
        <input id="password" type="password" required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" className="h-13 rounded-control border border-hairline bg-page px-4 text-base focus:border-pitch focus:outline-none" />
        {signup && (
          <>
            <label htmlFor="password-again" className="text-sm font-semibold">Nhập lại mật khẩu</label>
            <input id="password-again" type="password" required minLength={8} autoComplete="new-password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} placeholder="Nhập lại mật khẩu" className="h-13 rounded-control border border-hairline bg-page px-4 text-base focus:border-pitch focus:outline-none" />
          </>
        )}
        <button
          type="submit"
          disabled={busy !== null}
          className="h-13 rounded-control bg-pitch text-base font-semibold text-pitch-ink disabled:opacity-60"
        >
          {busy === 'email' ? (signup ? 'Đang gửi mã…' : 'Đang đăng nhập…') : signup ? 'Đăng ký và nhận mã OTP' : hasBookingDraft ? 'Tiếp tục đặt sân' : 'Đăng nhập'}
        </button>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          {signup ? 'Mã OTP sẽ được gửi qua email để xác nhận tài khoản. Số điện thoại chỉ để chủ sân liên hệ khi cần.' : 'Dùng email và mật khẩu đã đăng ký để đăng nhập.'}
        </p>
      </form>
    </div>
  );
}

/** Logo Google bốn màu. Google yêu cầu dùng đúng mark này trên nút đăng nhập. */
function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true" className="flex-none">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.02-6.7 5.2-.1.3C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5v-.3l-6.8-5.3-.2.1C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 9.9l7-5.4z" />
      <path fill="#EA4335" d="M24 10.4c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.2 29.9 2 24 2 15.4 2 7.9 6.9 4.5 14.1l7 5.4c1.8-5.3 6.7-9.1 12.5-9.1z" />
    </svg>
  );
}

function Envelope() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="1" y="6.5" width="32" height="22" rx="3" className="fill-card stroke-strong" strokeWidth="1.5" />
      <path d="M2.5 8.5L17 19.5L31.5 8.5" className="stroke-free-line" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
