'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, LoaderCircle, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { IMAGE_ACCEPT, IMAGE_HINT, imagePath, tournamentCoverSrc, validateImage } from '@/lib/image-upload';

export function TournamentPhotoUpload({ userId, initialPath = '', onPreview }: { userId: string; initialPath?: string; onPreview: (src: string | null) => void }) {
  const db = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [path, setPath] = useState(initialPath);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const src = preview ?? tournamentCoverSrc(path);

  async function choose(file: File) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    let uploaded: string | null = null;
    try {
      await validateImage(file);
      const local = URL.createObjectURL(file);
      setPreview(local); onPreview(local);
      uploaded = imagePath(userId, file);
      const { error } = await db.storage.from('tournament-photos').upload(uploaded, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('Chưa tải được ảnh. Kiểm tra mạng và thử lại.');
      const previous = path;
      setPath(uploaded); onPreview(tournamentCoverSrc(uploaded));
      // Không xóa ảnh đã lưu trên giải; SQL giữ các file đang được sử dụng.
      if (previous && previous !== initialPath) await db.storage.from('tournament-photos').remove([previous]).catch(() => {});
    } catch (error) {
      if (uploaded) await db.storage.from('tournament-photos').remove([uploaded]).catch(() => {});
      onPreview(tournamentCoverSrc(path));
      setError(error instanceof Error ? error.message : 'Chưa tải được ảnh. Vui lòng thử lại.');
    } finally {
      setPreview(null); setBusy(false); lock.current = false;
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    if (lock.current) return;
    const previous = path;
    setPath(''); onPreview(null); setError('');
    if (previous && previous !== initialPath) await db.storage.from('tournament-photos').remove([previous]).catch(() => {});
  }

  return <div data-image-uploading={busy} aria-busy={busy} className="space-y-3">
    <p className="text-sm font-semibold text-pitch">Ảnh bìa giải đấu <span className="font-normal text-ink-secondary">(tùy chọn)</span></p>
    {src && <div className="relative aspect-video overflow-hidden rounded-control border border-hairline bg-sunk"><Image src={src} alt="Xem trước ảnh bìa giải đấu" fill unoptimized className="object-cover" /></div>}
    <input type="hidden" name="cover_path" value={path} />
    <input ref={input} type="file" aria-label="Chọn ảnh bìa giải đấu" accept={IMAGE_ACCEPT} hidden onChange={event => { const file = event.target.files?.[0]; if (file) void choose(file); }} />
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch disabled:opacity-60">{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Camera aria-hidden="true" className="size-4" />}{busy ? 'Đang tải ảnh…' : path ? 'Đổi ảnh bìa' : 'Tải ảnh bìa'}</button>
      {path && <button type="button" disabled={busy} onClick={() => void remove()} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-ink-secondary hover:text-danger disabled:opacity-60"><Trash2 aria-hidden="true" className="size-4" />Bỏ ảnh</button>}
    </div>
    <p className="text-xs leading-6 text-ink-secondary">{IMAGE_HINT}. Nên chọn ảnh ngang. Ảnh xuất hiện khi bạn lưu hoặc gửi giải đấu.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
