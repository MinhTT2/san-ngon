'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const INPUT = 'h-12 w-full rounded-control border border-hairline bg-card px-3.5 focus:border-pitch focus:outline-none';

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [number, setNumber] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone: number }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? 'Chưa lưu được thông tin. Vui lòng thử lại.');
        return;
      }
      setName(json.profile.full_name);
      setNumber(json.profile.phone);
      setSaved(true);
      router.refresh();
    } catch {
      setError('Không kết nối được. Kiểm tra mạng và thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-card border border-hairline bg-card p-5 sm:p-8">
      <fieldset disabled={busy} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="profile-email" className="block text-sm font-semibold">Email đăng nhập</label>
          <input id="profile-email" type="email" value={email} readOnly className={`${INPUT} bg-sunk text-ink-secondary`} />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-name" className="block text-sm font-semibold">Họ và tên</label>
          <input id="profile-name" name="full_name" autoComplete="name" required minLength={2} maxLength={100}
            value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} className={INPUT} />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-phone" className="block text-sm font-semibold">Số điện thoại</label>
          <input id="profile-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required pattern="0[0-9]{9}" maxLength={10}
            aria-describedby="profile-phone-hint" value={number} onChange={(event) => { setNumber(event.target.value); setSaved(false); }} className={INPUT} />
          <p id="profile-phone-hint" className="text-xs leading-5 text-ink-secondary">10 chữ số, bắt đầu bằng 0. Thông tin này được điền sẵn cho lần đặt sân tiếp theo.</p>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {saved && <p role="status" className="text-sm text-pitch">Đã lưu thông tin tài khoản.</p>}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-control bg-pitch px-6 text-sm font-semibold text-pitch-ink disabled:opacity-60 sm:w-auto">
          {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </fieldset>
    </form>
  );
}
