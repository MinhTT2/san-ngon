'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Link trong email quay về đây; ?loi=1 là do /auth/callback đá về. */
const CALLBACK_ERROR =
  'Link đăng nhập không dùng được nữa. Link chỉ dùng một lần và hết hạn sau một giờ — gửi lại link mới giúp bạn nhé.';

export function LoginForm() {
  const supabase = createClient();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('loi') ? CALLBACK_ERROR : null
  );

  // Thiếu NEXT_PUBLIC_SITE_URL thì chuỗi ra "undefined/auth/callback" và cả
  // hai cách đăng nhập đều hỏng mà không báo gì. Lấy origin của trình duyệt
  // làm phương án dự phòng — trên bản preview của Vercel cũng đúng luôn.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window === 'undefined' ? '' : window.location.origin);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  async function otp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-strong bg-free-fill p-5">
        <p className="text-sm leading-relaxed">
          Đã gửi link đăng nhập tới <strong>{email}</strong>. Mở hộp thư rồi bấm vào link.
        </p>
        <p className="text-xs leading-relaxed text-ink-secondary">
          Không thấy thư sau một phút thì xem thư mục spam. Link dùng một lần và hết hạn sau một giờ.
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); setError(null); }}
          className="self-start text-sm font-semibold text-pitch underline underline-offset-2"
        >
          Gửi lại hoặc đổi email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3.5 text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}
      <button
        onClick={google}
        disabled={busy}
        className="h-13 rounded-control bg-pitch text-base font-semibold text-pitch-ink disabled:opacity-60"
      >
        Tiếp tục với Google
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-secondary">
        <span className="h-px flex-grow bg-hairline" />hoặc<span className="h-px flex-grow bg-hairline" />
      </div>

      <form onSubmit={otp} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-semibold">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@example.com"
          className="h-13 rounded-control border border-hairline bg-card px-4 text-base"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-13 rounded-control border border-hairline bg-card text-base font-semibold disabled:opacity-60"
        >
          Gửi link đăng nhập
        </button>
      </form>

    </div>
  );
}
