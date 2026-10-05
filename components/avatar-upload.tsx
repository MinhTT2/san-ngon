'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, LoaderCircle, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { IMAGE_ACCEPT, IMAGE_HINT, imagePath, validateImage } from '@/lib/image-upload';
import { UserAvatar } from './user-avatar';

export function AvatarUpload({ userId, name, avatar }: { userId: string; name: string; avatar: string | null }) {
  const router = useRouter();
  const db = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [photo, setPhoto] = useState(avatar);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => setPhoto(avatar), [avatar]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function changePhoto(file: File | null) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(''); setMessage('');
    let path: string | null = null;
    let saved = false;
    try {
      if (file) {
        await validateImage(file);
        setPreview(URL.createObjectURL(file));
        path = imagePath(userId, file);
        const { error } = await db.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error('Chưa tải được ảnh. Kiểm tra mạng và thử lại.');
      }
      const { data, error } = await db.rpc('set_profile_avatar', { p_path: path });
      if (error) throw new Error(error.message.includes('ACCOUNT_BANNED') ? 'Tài khoản đang bị khóa.' : 'Chưa lưu được ảnh. Hãy thử lại hoặc đăng nhập lại.');
      saved = true;
      setPhoto(data.avatar_url);
      setMessage(file ? 'Đã lưu ảnh đại diện.' : 'Đã xóa ảnh đại diện.');
      router.refresh();
      if (data.previous_avatar_url?.startsWith(`${userId}/`) && data.previous_avatar_url !== path) {
        await db.storage.from('avatars').remove([data.previous_avatar_url]).catch(() => {});
      }
    } catch (error) {
      if (path && !saved) await db.storage.from('avatars').remove([path]).catch(() => {});
      setError(error instanceof Error ? error.message : 'Chưa tải được ảnh. Vui lòng thử lại.');
    } finally {
      setPreview(null); setBusy(false); lock.current = false;
      if (input.current) input.current.value = '';
    }
  }

  return <div aria-busy={busy}>
    <div className="flex items-center gap-4">
      <UserAvatar name={name} avatar={preview ?? photo} className={`size-24 border-4 border-card text-4xl ${busy ? 'opacity-60' : ''}`} />
      <div className="min-w-0">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-control border border-hairline bg-card px-3 text-xs font-semibold text-pitch disabled:opacity-60">
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Camera aria-hidden="true" className="size-4" />}{busy ? 'Đang lưu ảnh…' : photo ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện'}
        </button>
        <input ref={input} type="file" aria-label="Chọn ảnh đại diện" accept={IMAGE_ACCEPT} hidden onChange={event => { const file = event.target.files?.[0]; if (file) void changePhoto(file); }} />
        {photo && <button type="button" disabled={busy} onClick={() => void changePhoto(null)} className="mt-1 flex min-h-11 items-center gap-2 text-xs text-ink-secondary hover:text-danger disabled:opacity-60"><Trash2 aria-hidden="true" className="size-3.5" />Xóa ảnh đại diện</button>}
      </div>
    </div>
    <p className="mt-3 text-xs leading-6 text-ink-secondary">{IMAGE_HINT}. Ảnh được lưu ngay, dùng chung cho tài khoản và hồ sơ Kết nối.</p>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-pitch">{message}</p>}
  </div>;
}
