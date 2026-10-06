'use client';

import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, RotateCcw, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { IMAGE_ACCEPT, IMAGE_HINT, imagePath, tournamentCoverSrc, validateImage } from '@/lib/image-upload';
import { ImageCropDialog } from './image-crop-dialog';

export function TournamentPhotoUpload({ userId, initialPath = '', onPreview }: { userId: string; initialPath?: string; onPreview: (src: string | null) => void }) {
  const db = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const retry = useRef<File | null>(null);
  const lock = useRef(false);
  const id = useId();
  const [path, setPath] = useState(initialPath);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const working = busy || !!editing;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { zone.current?.dispatchEvent(new CustomEvent('image-upload-state', { bubbles: true })); }, [working, path]);
  const src = preview ?? tournamentCoverSrc(path);

  async function select(files: FileList | File[]) {
    if (lock.current || editing) return;
    setError(''); setMessage(''); retry.current = null;
    if (files.length !== 1) { setError('Chọn một ảnh bìa cho giải đấu.'); return; }
    lock.current = true; setBusy(true);
    try { await validateImage(files[0]); setEditing(files[0]); }
    catch (error) { setError(error instanceof Error ? error.message : 'Không đọc được ảnh.'); }
    finally { setBusy(false); lock.current = false; if (input.current) input.current.value = ''; }
  }

  async function upload(file: File) {
    if (lock.current) return;
    lock.current = true; setEditing(null); setBusy(true); setError(''); retry.current = null;
    let uploaded: string | null = null;
    try {
      const local = URL.createObjectURL(file);
      setPreview(local); onPreview(local);
      uploaded = imagePath(userId, file);
      const { error } = await db.storage.from('tournament-photos').upload(uploaded, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('Chưa tải được ảnh. Kiểm tra mạng rồi thử lại.');
      const previous = path;
      setPath(uploaded); setFileName(file.name); setMessage('Ảnh đã sẵn sàng. Gửi giải đấu để lưu ảnh cùng thông tin giải.'); onPreview(tournamentCoverSrc(uploaded));
      if (previous && previous !== initialPath) await db.storage.from('tournament-photos').remove([previous]).catch(() => {});
    } catch (error) {
      if (uploaded) await db.storage.from('tournament-photos').remove([uploaded]).catch(() => {});
      retry.current = file; onPreview(tournamentCoverSrc(path));
      setError(error instanceof Error ? error.message : 'Chưa tải được ảnh. Vui lòng thử lại.');
    } finally { setPreview(null); setBusy(false); lock.current = false; }
  }

  async function remove() {
    if (working) return;
    const previous = path;
    setPath(''); setFileName(''); onPreview(null); setError(''); retry.current = null;
    setMessage('Đã bỏ ảnh khỏi bản đang chỉnh. Gửi giải đấu để lưu thay đổi.');
    if (previous && previous !== initialPath) await db.storage.from('tournament-photos').remove([previous]).catch(() => {});
  }

  return <div ref={zone} data-image-uploading={working} aria-busy={busy} className="space-y-3">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-pitch">Ảnh bìa giải đấu</p><span className="rounded-pill border border-hairline px-2.5 py-1 text-[11px] text-ink-secondary">Tùy chọn</span></div>
    <div onDragOver={event => { event.preventDefault(); if (!working) setDragging(true); }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!working) void select(event.dataTransfer.files); }}
      className={`overflow-hidden rounded-card border transition-colors ${dragging ? 'border-pitch bg-free-fill outline-2 outline-pitch' : error ? 'border-danger/40 bg-card' : 'border-hairline bg-card'}`}>
      {src ? <div className="relative aspect-video overflow-hidden bg-sunk"><Image src={src} alt="Xem trước ảnh bìa giải đấu" fill unoptimized className="object-cover" />{busy && <div className="absolute inset-0 grid place-items-center bg-pitch/65 text-pitch-ink"><span className="flex items-center gap-2 text-sm font-semibold"><LoaderCircle className="size-5 pf-spin" aria-hidden="true" />Đang tải ảnh…</span></div>}</div>
        : <button type="button" disabled={working} aria-describedby={`${id}-hint`} onClick={() => input.current?.click()} className={`group flex min-h-44 w-full flex-col items-center justify-center gap-3 border-b border-dashed px-5 py-6 text-center hover:bg-free-fill disabled:opacity-60 sm:min-h-48 ${dragging ? 'border-pitch' : 'border-hairline'}`}>
          <span className="grid size-12 place-items-center rounded-card border border-strong bg-free-fill text-pitch"><ImagePlus className="size-6" strokeWidth={1.5} aria-hidden="true" /></span><span className="text-sm font-semibold text-pitch">{dragging ? 'Thả ảnh vào đây' : 'Thêm khoảnh khắc của giải đấu'}</span><span className="text-xs leading-6 text-ink-secondary"><span className="hidden sm:inline">Kéo ảnh vào đây hoặc </span><span className="font-semibold text-pitch underline underline-offset-4">chọn ảnh từ thiết bị</span></span>
        </button>}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-pitch">{fileName || (path ? 'Ảnh bìa đang dùng' : 'Ảnh ngang · Khung hình 16:9')}</p><p className="mt-1 text-[11px] text-ink-secondary">{IMAGE_HINT}</p></div>
        <div className="flex gap-1"><button type="button" disabled={working} onClick={() => input.current?.click()} className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch hover:border-pitch hover:bg-free-fill disabled:opacity-60">{busy ? <LoaderCircle aria-hidden="true" className="size-4 pf-spin" /> : <Upload aria-hidden="true" className="size-4" />}{busy ? 'Đang tải ảnh…' : path ? 'Đổi ảnh bìa' : 'Tải ảnh bìa'}</button>{path && <button type="button" aria-label="Bỏ ảnh" title="Bỏ ảnh bìa" disabled={working} onClick={() => void remove()} className="grid size-11 place-items-center rounded-control text-ink-secondary hover:bg-danger/5 hover:text-danger disabled:opacity-60"><Trash2 className="size-4" aria-hidden="true" /></button>}</div>
      </div>
    </div>
    <input type="hidden" name="cover_path" value={path} />
    <input ref={input} type="file" aria-label="Chọn ảnh bìa giải đấu" accept={IMAGE_ACCEPT} hidden onChange={event => { if (event.target.files?.length) void select(event.target.files); }} />
    <p id={`${id}-hint`} className="text-xs leading-6 text-ink-secondary">Chọn ảnh thi đấu hoặc poster của bạn. Bạn có thể chỉnh khung trước khi dùng; giữ nội dung chính ở giữa ảnh.</p>
    {error && <div className="rounded-control border border-danger/30 bg-danger/5 p-3"><p role="alert" className="text-sm leading-6 text-danger">{error}<span className="block text-xs">Ảnh và thông tin đã nhập được giữ nguyên.</span></p>{retry.current && <button type="button" onClick={() => void upload(retry.current!)} className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-danger"><RotateCcw className="size-4" aria-hidden="true" />Thử tải lại ảnh</button>}</div>}
    {message && !error && <p role="status" className="flex items-start gap-2 text-xs leading-6 text-success"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{message}</p>}
    {editing && <ImageCropDialog file={editing} kind="cover" onCancel={() => setEditing(null)} onApply={file => void upload(file)} />}
  </div>;
}
