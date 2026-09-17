'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const supabase = createClient();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;

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
      <div className="rounded-card border border-strong bg-free-fill p-5">
        <p className="text-sm">
          Đã gửi link đăng nhập tới <strong>{email}</strong>. Mở hộp thư rồi bấm vào link.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
