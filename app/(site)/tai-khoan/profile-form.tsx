'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, CheckCheck, CircleUserRound, LoaderCircle, LockKeyhole, Mail, Phone, Save, Ticket, UserRound } from 'lucide-react';
import { normalizePhone } from '@/lib/profile';
import { AvatarUpload } from '@/components/avatar-upload';

const INPUT = 'profile-input h-13 w-full rounded-control border border-hairline bg-page pl-11 pr-4 text-sm outline-none focus:border-pitch focus:bg-card';

export function ProfileForm({ userId, fullName, phone, email, avatar, role }: {
  userId: string; fullName: string; phone: string; email: string; avatar: string | null; role: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [number, setNumber] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState({ name: fullName, phone });
  const dirty = name.trim() !== baseline.name.trim() || normalizePhone(number) !== normalizePhone(baseline.phone);
  const roleLabel = role === 'admin' ? 'Quản trị viên' : role === 'owner' ? 'Chủ sân' : 'Người chơi';

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function discard() {
    setName(baseline.name); setNumber(baseline.phone); setError(null); setSaved(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone: number }),
      });
      const json = await response.json();
      if (!response.ok) { setError(json.error ?? 'Chưa lưu được thông tin. Vui lòng thử lại.'); return; }
      setName(json.profile.full_name); setNumber(json.profile.phone); setSaved(true);
      setBaseline({ name: json.profile.full_name, phone: json.profile.phone });
      router.refresh();
    } catch { setError('Không kết nối được. Kiểm tra mạng và thử lại.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
      <section aria-label="Ảnh đại diện" className="profile-enter profile-delay-1 overflow-hidden rounded-card border border-hairline bg-card">
        <div className="relative h-28 overflow-hidden bg-pitch" aria-hidden="true">
          <svg viewBox="0 0 320 144" fill="none" className="profile-court absolute inset-0 size-full text-free-line/25">
            <path d="M30 20H290V124H30ZM160 20V124M30 49H67V95H30M290 49H253V95H290" stroke="currentColor" />
            <circle cx="160" cy="72" r="29" stroke="currentColor" /><circle cx="160" cy="72" r="3" fill="currentColor" />
          </svg>
          <span className="absolute left-6 top-5 text-[10px] font-medium uppercase tracking-[0.24em] text-pitch-ink/70">Sân Ngon · Cùng ra sân</span>
        </div>
        <div className="relative px-6 pb-6">
          <div className="relative -mt-12"><AvatarUpload userId={userId} name={name} avatar={avatar} layout="portrait" /></div>
          <div className="mt-5 border-t border-hairline pt-5 text-center"><span className="inline-flex rounded-pill border border-strong bg-free-fill px-3 py-1 text-[11px] font-medium text-pitch">{roleLabel}</span>
          <h2 className="mt-3 break-words font-display text-2xl font-bold tracking-tight text-pitch">{name.trim() || 'Chào bạn!'}</h2>
          <p className="mt-2 break-all text-xs leading-5 text-ink-secondary">{email}</p></div>
        </div>
      </section>

      <div className="min-w-0 space-y-5">
        <form onSubmit={submit} aria-busy={busy} className="profile-enter profile-delay-2 overflow-hidden rounded-card border border-hairline bg-card">
          <div className="flex items-center gap-4 border-b border-hairline p-5 sm:px-7 sm:py-6">
            <span className="grid size-11 place-items-center rounded-control bg-free-fill text-pitch"><CircleUserRound aria-hidden="true" className="size-5" strokeWidth={1.5} /></span>
            <div><h2 className="font-display text-xl font-bold text-pitch">Thông tin cá nhân</h2><p className="mt-1 text-xs leading-5 text-ink-secondary">Để mỗi lần đặt sân đều nhanh hơn một chút.</p></div>
          </div>
          <fieldset disabled={busy} className="space-y-6 p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2.5">
                <label htmlFor="profile-name" className="block text-xs font-semibold">Họ và tên</label>
                <div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-4.5 size-4 text-ink-secondary" />
                  <input id="profile-name" name="full_name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Tên của bạn"
                    value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} className={INPUT} /></div>
              </div>
              <div className="space-y-2.5">
                <label htmlFor="profile-phone" className="block text-xs font-semibold">Số điện thoại</label>
                <div className="relative"><Phone aria-hidden="true" className="pointer-events-none absolute left-4 top-4.5 size-4 text-ink-secondary" />
                  <input id="profile-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="0912 345 678"
                    aria-describedby="profile-phone-hint" value={number} onBlur={() => setNumber(normalizePhone(number))}
                    onChange={(event) => { setNumber(event.target.value); setSaved(false); }} className={INPUT} /></div>
              </div>
            </div>
            <p id="profile-phone-hint" className="-mt-2 flex items-start gap-2 text-xs leading-5 text-ink-secondary"><CheckCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />Bạn có thể nhập +84. Sân Ngon tự đổi về số bắt đầu bằng 0.</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2"><label htmlFor="profile-email" className="text-xs font-semibold">Email đăng nhập</label><span className="flex items-center gap-1.5 text-[10px] text-ink-secondary"><LockKeyhole aria-hidden="true" className="size-3" />Chỉ xem</span></div>
              <div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-4.5 size-4 text-ink-secondary" /><input id="profile-email" type="email" value={email} readOnly className={`${INPUT} text-ink-secondary`} /></div>
              <p className="text-[11px] leading-5 text-ink-secondary">Email bạn dùng để đăng nhập vào Sân Ngon.</p>
            </div>
            <div className="flex gap-3 rounded-control bg-free-fill p-4"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pitch" /><p className="text-xs leading-6 text-ink-secondary">Tên và số điện thoại sẽ được điền sẵn khi đặt sân. Thông tin trên những đơn đã đặt được giữ nguyên.</p></div>
            {error && <p role="alert" className="profile-feedback text-sm text-danger">{error}</p>}
            <div className="flex flex-col-reverse gap-4 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" className="text-xs leading-6 text-ink-secondary">{busy ? 'Đang lưu thông tin…' : dirty ? 'Có thay đổi chưa lưu.' : saved ? 'Đã lưu thông tin tài khoản.' : 'Chưa có thay đổi.'}</p>
              <div className="flex flex-wrap items-center gap-2">
              {dirty && <button type="button" onClick={discard} disabled={busy} className="pf-action min-h-11 rounded-control border border-hairline px-4 text-xs font-semibold text-ink-secondary disabled:opacity-60">Bỏ thay đổi</button>}
              <button type="submit" disabled={busy || !dirty} className="pf-action profile-save flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control bg-pitch px-4 py-2.5 text-sm font-semibold text-pitch-ink disabled:opacity-60 sm:flex-none">
                {busy ? <LoaderCircle aria-hidden="true" className="pf-spin size-4" /> : saved ? <Check aria-hidden="true" className="size-4" /> : <Save aria-hidden="true" className="size-4" />}{busy ? 'Đang lưu…' : saved && !dirty ? 'Đã lưu' : 'Lưu thay đổi'}
              </button>
              </div>
            </div>
          </fieldset>
        </form>
        <div className="profile-enter profile-delay-3 grid gap-4 sm:grid-cols-2">
          <Link href="/don-cua-toi" className="profile-shortcut group flex items-center gap-3 rounded-card border border-hairline bg-card p-5"><Ticket aria-hidden="true" className="size-5 shrink-0 text-pitch" strokeWidth={1.5} /><div className="flex-1"><h2 className="text-sm font-semibold">Đơn của tôi</h2><p className="mt-1 text-[11px] text-ink-secondary">Những cuộc hẹn sắp tới</p></div><ArrowUpRight aria-hidden="true" className="profile-link-arrow size-4 text-pitch" /></Link>
          <Link href="/tim-san" className="profile-shortcut group flex items-center gap-3 rounded-card border border-strong bg-free-fill p-5"><div className="flex-1"><h2 className="text-sm font-semibold text-pitch">Hôm nay, chơi gì?</h2><p className="mt-1 text-[11px] text-ink-secondary">Tìm một sân thật vừa ý</p></div><ArrowUpRight aria-hidden="true" className="profile-link-arrow size-5 text-pitch" /></Link>
        </div>
      </div>
    </div>
  );
}
