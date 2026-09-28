'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Camera, Check, CheckCheck, CircleUserRound, ImagePlus, LoaderCircle, LockKeyhole, Mail, Phone, Save, Ticket, Trash2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { normalizePhone } from '@/lib/profile';
import { UserAvatar } from '@/components/user-avatar';

const INPUT = 'profile-input h-13 w-full rounded-control border border-hairline bg-page pl-11 pr-4 text-sm outline-none focus:border-pitch focus:bg-card';

export function ProfileForm({ userId, fullName, phone, email, avatar, role }: {
  userId: string; fullName: string; phone: string; email: string; avatar: string | null; role: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(fullName);
  const [number, setNumber] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [photo, setPhoto] = useState(avatar);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const roleLabel = role === 'admin' ? 'Quản trị viên' : role === 'owner' ? 'Chủ sân' : 'Người chơi';

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function changePhoto(file: File | null) {
    if (uploading) return;
    setUploading(true); setPhotoError(null); setPhotoMessage(null);
    let path: string | null = null;
    try {
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
          throw new Error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.');
        }
        try { const bitmap = await createImageBitmap(file); bitmap.close(); }
        catch { throw new Error('Không đọc được ảnh này. Bạn thử chọn ảnh khác nhé.'); }
        setPreview(URL.createObjectURL(file));
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
        path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error('Chưa tải được ảnh. Kiểm tra mạng và thử lại.');
      }
      const { data, error } = await supabase.rpc('set_profile_avatar', { p_path: path });
      if (error) throw new Error(error.message.includes('ACCOUNT_BANNED') ? 'Tài khoản đang bị khóa.' : 'Chưa lưu được ảnh. Hãy thử lại hoặc đăng nhập lại.');
      setPhoto(data.avatar_url);
      setPhotoMessage(file ? 'Ảnh mới đã sẵn sàng!' : 'Đã xóa ảnh đại diện.');
      router.refresh();
      // Chỉ xóa file đã bỏ liên kết. RLS giữ ảnh đang dùng nếu tab khác vừa chọn lại.
      if (data.previous_avatar_url?.startsWith(`${userId}/`) && data.previous_avatar_url !== path) {
        await supabase.storage.from('avatars').remove([data.previous_avatar_url]).catch(() => {});
      }
    } catch (error) {
      if (path) await supabase.storage.from('avatars').remove([path]).catch(() => {});
      setPhotoError(error instanceof Error ? error.message : 'Chưa tải được ảnh. Vui lòng thử lại.');
    } finally {
      setPreview(null); setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone: number }),
      });
      const json = await response.json();
      if (!response.ok) { setError(json.error ?? 'Chưa lưu được thông tin. Vui lòng thử lại.'); return; }
      setName(json.profile.full_name); setNumber(json.profile.phone); setSaved(true);
      router.refresh();
    } catch { setError('Không kết nối được. Kiểm tra mạng và thử lại.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
      <section aria-label="Ảnh đại diện" className="profile-enter profile-delay-1 overflow-hidden rounded-card border border-hairline bg-card">
        <div className="relative h-36 overflow-hidden bg-pitch" aria-hidden="true">
          <svg viewBox="0 0 320 144" fill="none" className="profile-court absolute inset-0 size-full text-free-line/25">
            <path d="M30 20H290V124H30ZM160 20V124M30 49H67V95H30M290 49H253V95H290" stroke="currentColor" />
            <circle cx="160" cy="72" r="29" stroke="currentColor" /><circle cx="160" cy="72" r="3" fill="currentColor" />
          </svg>
          <span className="absolute left-6 top-5 text-[10px] font-medium uppercase tracking-[0.24em] text-pitch-ink/70">Sân Ngon · Cùng ra sân</span>
        </div>
        <div className="relative px-6 pb-6">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <div className="group relative rounded-full border-[6px] border-card bg-card">
              <UserAvatar name={name} avatar={preview ?? photo} className={`size-24 text-4xl ${uploading ? 'opacity-60' : ''}`} />
              <button type="button" aria-label="Đổi ảnh đại diện" disabled={uploading} onClick={() => fileInput.current?.click()}
                className="pf-action absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-[3px] border-card bg-pitch text-pitch-ink disabled:opacity-60">
                {uploading ? <LoaderCircle aria-hidden="true" className="pf-spin size-4" /> : <Camera aria-hidden="true" className="size-4" />}
              </button>
            </div>
            <span className="mb-2 rounded-pill border border-hairline px-3 py-1 text-[11px] font-medium text-ink-secondary">{roleLabel}</span>
          </div>
          <h2 className="mt-4 break-words font-display text-2xl font-bold tracking-tight text-pitch">{name.trim() || 'Chào bạn!'}</h2>
          <p className="mt-1 break-all text-xs leading-5 text-ink-secondary">{email}</p>
          <div className="my-5 h-px bg-hairline" />
          <input ref={fileInput} type="file" aria-label="Chọn ảnh đại diện" accept="image/jpeg,image/png,image/webp" hidden
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void changePhoto(file); }} />
          <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void changePhoto(file); }}
            className={`profile-upload group flex w-full flex-col items-center rounded-control border border-dashed px-4 py-5 disabled:opacity-60 ${dragging ? 'border-pitch bg-free-fill' : 'border-strong bg-page hover:border-pitch hover:bg-free-fill'}`}>
            <ImagePlus aria-hidden="true" className="profile-upload-icon mb-2.5 size-6 text-pitch" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-pitch">{uploading ? 'Đang cập nhật ảnh…' : 'Thêm một chút cá tính'}</span>
            <span className="mt-1 text-xs leading-5 text-ink-secondary">Kéo thả hoặc bấm để chọn ảnh</span>
            <span className="mt-2 text-[10px] text-ink-secondary">JPG, PNG, WebP · Tối đa 5 MB</span>
          </button>
          {photo && <button type="button" disabled={uploading} onClick={() => void changePhoto(null)} className="pf-action mx-auto mt-3 flex items-center gap-1.5 rounded-control px-3 py-2 text-xs text-ink-secondary hover:text-danger disabled:opacity-50"><Trash2 aria-hidden="true" className="size-3.5" />Xóa ảnh đại diện</button>}
          <p className="mt-3 text-center text-[11px] leading-5 text-ink-secondary">Ảnh được lưu ngay và hiển thị trên tài khoản.</p>
          {photoError && <p role="alert" className="mt-3 text-sm leading-5 text-danger">{photoError}</p>}
          {photoMessage && <p role="status" className="profile-feedback mt-3 flex items-center justify-center gap-2 text-xs text-pitch"><Check aria-hidden="true" className="size-4" />{photoMessage}</p>}
        </div>
      </section>

      <div className="min-w-0 space-y-5">
        <form onSubmit={submit} className="profile-enter profile-delay-2 overflow-hidden rounded-card border border-hairline bg-card">
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
            {saved && <p role="status" className="profile-feedback flex items-center gap-2 text-sm text-pitch"><Check aria-hidden="true" className="pf-check-pop size-5" />Đã lưu thông tin tài khoản.</p>}
            <div className="flex flex-col-reverse gap-4 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-[11px] text-ink-secondary sm:text-left">Thông tin đúng. Cuộc hẹn trọn vẹn.</p>
              <button type="submit" disabled={busy} className="pf-action profile-save flex h-12 items-center justify-center gap-2.5 rounded-control bg-pitch px-6 text-sm font-semibold text-pitch-ink disabled:opacity-60">
                {busy ? <LoaderCircle aria-hidden="true" className="pf-spin size-4" /> : saved ? <Check aria-hidden="true" className="size-4" /> : <Save aria-hidden="true" className="size-4" />}{busy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
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
