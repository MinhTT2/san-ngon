'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function PasswordResetForm({ mode }: { mode: 'request' | 'update' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || cooldown) return;
    setError('');
    if (mode === 'update' && password !== confirmation) {
      setError('Hai mật khẩu chưa khớp. Vui lòng nhập lại.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = mode === 'request'
        ? await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/dat-lai-mat-khau`,
        })
        : await supabase.auth.updateUser({ password });
      if (error) {
        if (error.code === 'same_password') setError('Mật khẩu mới cần khác mật khẩu hiện tại.');
        else if (error.status === 429) {
          setError('Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.');
          setCooldown(60);
        } else if (mode === 'update' && (error.status === 401 || error.status === 403 || error.code === 'session_not_found')) {
          setError('Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu một email mới.');
        } else setError(mode === 'request' ? 'Chưa gửi được email. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.' : 'Chưa đổi được mật khẩu. Dùng mật khẩu ít nhất 8 ký tự rồi thử lại.');
        return;
      }
      setDone(true);
      if (mode === 'request') setCooldown(60);
      else { setPassword(''); setConfirmation(''); }
    } catch {
      setError('Không kết nối được. Kiểm tra mạng rồi thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'update' && done) return <div role="status" className="space-y-4"><p className="font-semibold text-pitch">Đã cập nhật mật khẩu.</p><p className="text-sm text-ink-secondary">Lần đăng nhập sau, hãy dùng mật khẩu mới.</p><Link href="/don-cua-toi" className="inline-flex min-h-12 items-center rounded-control bg-pitch px-5 font-semibold text-pitch-ink">Về đơn của tôi</Link></div>;

  return <form onSubmit={submit} className="flex flex-col gap-4">
    {mode === 'request' ? <label className="flex flex-col gap-2 text-sm font-semibold">Email đã đăng ký
      <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="h-12 rounded-control border border-hairline px-3 font-normal" placeholder="ban@example.com" />
    </label> : <>
      <label className="flex flex-col gap-2 text-sm font-semibold">Mật khẩu mới
        <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="h-12 rounded-control border border-hairline px-3 font-normal" />
      </label>
      <p className="text-xs text-ink-secondary">Ít nhất 8 ký tự. Nên kết hợp chữ, số và ký tự đặc biệt.</p>
      <label className="flex flex-col gap-2 text-sm font-semibold">Nhập lại mật khẩu mới
        <input type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="h-12 rounded-control border border-hairline px-3 font-normal" />
      </label>
    </>}
    {done && <p role="status" className="rounded-control bg-free-fill p-4 text-sm leading-6 text-free-ink">Nếu email này có tài khoản, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu. Kiểm tra cả thư rác và mở liên kết bằng trình duyệt đang dùng. Chỉ sử dụng email mới nhất.</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <button disabled={busy || cooldown > 0} className="min-h-12 rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang xử lý…' : cooldown ? `Thử lại sau ${cooldown} giây` : mode === 'update' ? 'Lưu mật khẩu mới' : done ? 'Gửi lại email' : 'Gửi email đặt lại mật khẩu'}</button>
    {mode === 'update' && <Link href="/quen-mat-khau" className="text-sm font-semibold text-pitch underline">Yêu cầu email mới</Link>}
    <Link href="/dang-nhap" className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Quay lại đăng nhập</Link>
  </form>;
}
