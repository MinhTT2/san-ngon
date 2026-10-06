'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { IMAGE_ACCEPT, IMAGE_HINT, imagePath, validateImage } from '@/lib/image-upload';
import { UserAvatar } from './user-avatar';
import { ImageCropDialog } from './image-crop-dialog';

export function AvatarUpload({ userId, name, avatar, layout = 'inline' }: { userId: string; name: string; avatar: string | null; layout?: 'inline' | 'portrait' }) {
  const router = useRouter();
  const db = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const retry = useRef<File | null>(null);
  const lock = useRef(false);
  const id = useId();
  const [photo, setPhoto] = useState(avatar);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const portrait = layout === 'portrait';
  useEffect(() => setPhoto(avatar), [avatar]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function select(file: File) {
    if (lock.current || editing) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); retry.current = null;
    try { await validateImage(file); setEditing(file); }
    catch (error) { setError(error instanceof Error ? error.message : 'Không đọc được ảnh.'); }
    finally { setBusy(false); lock.current = false; if (input.current) input.current.value = ''; }
  }

  async function changePhoto(file: File | null) {
    if (lock.current) return;
    lock.current = true;
    setEditing(null); setBusy(true); setError(''); setMessage(''); retry.current = null;
    let path: string | null = null;
    let saved = false;
    try {
      if (file) {
        setPreview(URL.createObjectURL(file));
        path = imagePath(userId, file);
        const { error } = await db.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error('Chưa tải được ảnh. Kiểm tra mạng rồi thử lại.');
      }
      const { data, error } = await db.rpc('set_profile_avatar', { p_path: path });
      if (error) throw new Error(error.message.includes('ACCOUNT_BANNED') ? 'Tài khoản đang bị khóa.' : 'Chưa lưu được ảnh. Hãy thử lại hoặc đăng nhập lại.');
      saved = true;
      setPhoto(data.avatar_url);
      setMessage(file ? 'Đã lưu ảnh đại diện.' : 'Đã xóa ảnh đại diện.');
      router.refresh();
      if (data.previous_avatar_url?.startsWith(`${userId}/`) && data.previous_avatar_url !== path) await db.storage.from('avatars').remove([data.previous_avatar_url]).catch(() => {});
    } catch (error) {
      if (path && !saved) await db.storage.from('avatars').remove([path]).catch(() => {});
      retry.current = file;
      setError(error instanceof Error ? error.message : 'Chưa tải được ảnh. Vui lòng thử lại.');
    } finally { setPreview(null); setBusy(false); lock.current = false; }
  }

  return <div aria-busy={busy} className={portrait ? 'text-center' : ''}>
    <div className={portrait ? 'flex flex-col items-center gap-4' : 'flex flex-wrap items-center gap-5'}>
      <div className="relative shrink-0">
        <UserAvatar name={name} avatar={preview ?? photo} className={`${portrait ? 'size-28 text-5xl' : 'size-24 text-4xl'} border-[5px] border-card outline outline-1 outline-hairline ${busy ? 'opacity-60' : ''}`} />
        <button type="button" disabled={busy} aria-label="Chọn ảnh đại diện" aria-describedby={`${id}-hint`} onClick={() => input.current?.click()} className="absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full border-4 border-card bg-pitch text-pitch-ink hover:bg-success disabled:opacity-60"><Camera className="size-4" aria-hidden="true" /></button>
      </div>
      <div className="min-w-0 space-y-1">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-strong bg-card px-4 text-sm font-semibold text-pitch hover:bg-free-fill disabled:opacity-60">
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 pf-spin" /> : <Camera aria-hidden="true" className="size-4" />}{busy ? 'Đang lưu ảnh…' : photo ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện'}
        </button>
        <p className="text-xs leading-6 text-ink-secondary">{portrait ? 'Một gương mặt quen, dễ hẹn ra sân.' : 'Để người chơi dễ nhận ra bạn.'}</p>
      </div>
    </div>
    <input ref={input} type="file" aria-label="Chọn file ảnh đại diện" accept={IMAGE_ACCEPT} hidden onChange={event => { const file = event.target.files?.[0]; if (file) void select(file); }} />
    <p id={`${id}-hint`} className="mt-4 text-xs leading-6 text-ink-secondary">{IMAGE_HINT}<span className="block">Chỉnh khung ảnh trước khi lưu. Ảnh dùng chung cho tài khoản và Kết nối.</span></p>
    {photo && <button type="button" disabled={busy} onClick={() => void changePhoto(null)} className={`mt-2 inline-flex min-h-11 items-center gap-2 px-2 text-xs text-ink-secondary hover:text-danger disabled:opacity-60 ${portrait ? 'mx-auto' : ''}`}><Trash2 aria-hidden="true" className="size-3.5" />Xóa ảnh đại diện</button>}
    {error && <div className="mt-3 rounded-control border border-danger/30 bg-danger/5 p-3 text-left"><p role="alert" className="text-sm leading-6 text-danger">{error}<span className="block text-xs">Ảnh đang dùng được giữ nguyên.</span></p>{retry.current && <button type="button" onClick={() => void changePhoto(retry.current)} className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-danger"><RotateCcw className="size-4" aria-hidden="true" />Thử tải lại ảnh</button>}</div>}
    {message && <p role="status" className={`mt-3 flex items-center gap-2 text-xs leading-6 text-success ${portrait ? 'justify-center' : ''}`}><Check aria-hidden="true" className="size-4 shrink-0" />{message}</p>}
    {editing && <ImageCropDialog file={editing} kind="avatar" onCancel={() => setEditing(null)} onApply={file => void changePhoto(file)} />}
  </div>;
}
