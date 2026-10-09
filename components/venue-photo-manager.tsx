'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OWNER_PRIMARY, OWNER_SECONDARY } from './owner-form-field';

import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { PhotoUploadStatus, type PhotoPhase } from './photo-upload-status';

/** Ảnh marketing của cụm sân: lưu path trong DB, file thật nằm ở bucket public. */
export function VenuePhotoManager({ venueId, initialImages }: { venueId: string; initialImages: string[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [queue, setQueue] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [phases, setPhases] = useState(new Map<File, PhotoPhase>());
  const uploaded = useRef(new Map<File, string>());
  const expected = useRef<string[]>([]);
  const locked = useRef(false);
  const { confirmDiscard, markSaved } = useUnsavedChanges(queue.length > 0, busy);
  useEffect(() => {
    const urls = queue.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [queue]);
  const phase = (file: File, state: PhotoPhase) => setPhases(current => new Map(current).set(file, state));

  const url = (path: string) => supabase.storage.from('venue-photos').getPublicUrl(path).data.publicUrl;
  async function save(next: string[], previous = images) {
    const { error } = await supabase.rpc('set_venue_images', { p_venue_id: venueId, p_images: next, p_expected: previous });
    if (error) {
      // A successful save can lose its response. Don't duplicate or discard those photos.
      const { data: saved } = await supabase.from('venues').select('images').eq('id', venueId).single();
      if (JSON.stringify(saved?.images) !== JSON.stringify(next)) throw new Error(error.message.includes('IMAGES_CHANGED') ? 'Ảnh đã được cập nhật ở cửa sổ khác. Tải lại trang rồi thử lại.' : 'Chưa lưu được bộ ảnh. Kiểm tra mạng rồi thử lại.');
    }
    setImages(next);
    router.refresh();
  }
  async function upload(files: FileList | null) {
    if (!files?.length || locked.current || queue.length || images.length >= 8) return;
    const batch = Array.from(files);
    if (input.current) input.current.value = '';
    if (images.length + batch.length < 3 || images.length + batch.length > 8) { setMessage('Hãy chọn đủ để có tổng cộng 3–8 ảnh.'); return; }
    if (batch.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage('Ảnh cần là JPG, PNG hoặc WebP và nhỏ hơn 5MB.'); return;
    }
    expected.current = [...images];
    uploaded.current.clear(); setPhases(new Map()); setQueue(batch);
    await runBatch(batch);
  }
  async function runBatch(batch = queue) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage(null);
    try {
      const userId = await currentUserId();
      for (const file of batch) {
        if (uploaded.current.has(file)) continue;
        phase(file, 'uploading');
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
        const path = `${userId}/${venueId}/${crypto.randomUUID()}.${ext}`;
        try {
          const { error } = await supabase.storage.from('venue-photos').upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw error;
        } catch {
          phase(file, 'error');
          throw new Error(`Không tải được ảnh “${file.name}”. Thử lại để tải tiếp những ảnh còn thiếu.`);
        }
        uploaded.current.set(file, path); phase(file, 'uploaded');
      }
      await save([...expected.current, ...batch.map(file => uploaded.current.get(file)!)], expected.current);
      markSaved(); setQueue([]); uploaded.current.clear();
      setMessage('Đã lưu toàn bộ ảnh. Ảnh đầu tiên là ảnh bìa.');
    } catch (error) { setMessage((error as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function discardBatch() {
    if (locked.current || !confirmDiscard()) return;
    locked.current = true; setBusy(true);
    try {
      const paths = [...uploaded.current.values()];
      if (paths.length) {
        const { data: saved, error: readError } = await supabase.from('venues').select('images').eq('id', venueId).single();
        if (readError || !saved) throw new Error('Chưa kiểm tra được bộ ảnh đang lưu. Kiểm tra mạng rồi thử lại.');
        const unused = paths.filter(path => !saved.images.includes(path));
        const { error } = unused.length ? await supabase.storage.from('venue-photos').remove(unused) : { error: null };
        if (error) throw new Error('Chưa bỏ được ảnh đã tải. Kiểm tra mạng rồi thử lại.');
        setImages(saved.images);
      }
      markSaved(); setQueue([]); uploaded.current.clear(); setMessage('Đã bỏ lượt thêm ảnh. Bộ ảnh hiện tại được giữ nguyên.');
    } catch (error) { setMessage((error as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function remove(path: string) {
    if (locked.current || queue.length) return;
    if (images.length <= 3) { setMessage('Cụm sân cần giữ tối thiểu 3 ảnh.'); return; }
    locked.current = true; setBusy(true); setMessage(null);
    try { await save(images.filter((item) => item !== path)); await supabase.storage.from('venue-photos').remove([path]); setMessage('Đã xóa ảnh.'); }
    catch (error) { setMessage((error as Error).message); } finally { locked.current = false; setBusy(false); }
  }
  async function cover(path: string) {
    if (locked.current || queue.length || path === images[0]) return;
    locked.current = true; setBusy(true); setMessage(null);
    try { await save([path, ...images.filter((item) => item !== path)]); setMessage('Đã chọn ảnh bìa.'); }
    catch (error) { setMessage((error as Error).message); } finally { locked.current = false; setBusy(false); }
  }

  return <section data-unsaved-changes={queue.length > 0} data-unsaved-busy={busy} className="mt-5 rounded-control border border-hairline bg-sunk p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-pitch">Ảnh cụm sân</h3><p className="mt-1 max-w-xl text-sm leading-6 text-ink-secondary">Giữ tối thiểu 3 ảnh thật. Ảnh đầu tiên hiển thị trên danh sách tìm sân.</p></div><button type="button" disabled={busy || queue.length > 0 || images.length >= 8} onClick={() => input.current?.click()} className={OWNER_PRIMARY}>{busy ? 'Đang xử lý…' : '+ Thêm ảnh'}</button><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => upload(event.target.files)} /></div>{queue.length > 0 && <div className="mt-5 rounded-control border border-strong bg-card p-3 sm:p-4"><h4 className="font-semibold text-pitch">Ảnh đang thêm</h4><p role="status" className="mt-1 text-sm leading-6 text-ink-secondary">{[...phases.values()].filter(state => state === 'uploaded').length}/{queue.length} ảnh đã tải · bộ ảnh chỉ thay đổi khi lưu toàn bộ thành công.</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{queue.map((file, index) => <div key={index} className="overflow-hidden rounded-control border border-hairline"><div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${previews[index]})` }} /><p className="truncate p-2 text-xs" title={file.name}>{file.name}</p><PhotoUploadStatus phase={phases.get(file) ?? 'waiting'} /></div>)}</div><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => runBatch()} className={OWNER_PRIMARY}>Thử lại lượt thêm ảnh</button><button type="button" disabled={busy} onClick={discardBatch} className={OWNER_SECONDARY}>Bỏ lượt thêm ảnh</button></div><p className="mt-2 text-xs leading-6 text-ink-secondary">Giữ trang này mở để tải tiếp. Những ảnh đã tải sẽ được dùng lại khi thử lại.</p></div>}{message && <p role="status" className="mt-3 text-sm text-ink-secondary">{message}</p>}{images.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((path, index) => <div key={path} className="group relative overflow-hidden rounded-control border border-hairline bg-card"><div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${url(path)})` }} /><div className="flex flex-wrap items-center justify-between gap-1 px-2 py-1 text-xs"><span className="truncate">{index === 0 ? 'Ảnh bìa' : 'Ảnh sân'}</span><div className="flex flex-wrap gap-1"><button type="button" disabled={busy || queue.length > 0 || index === 0} onClick={() => cover(path)} className="pf-action min-h-11 min-w-11 rounded-control px-2 font-semibold text-pitch hover:bg-sunk disabled:opacity-30" aria-label={`Đặt ảnh ${index + 1} làm bìa`}>Đặt bìa</button><button type="button" disabled={busy || queue.length > 0 || images.length <= 3} onClick={() => remove(path)} className="pf-action min-h-11 min-w-11 rounded-control px-2 font-semibold text-danger hover:bg-sunk disabled:opacity-30" aria-label={`Xóa ảnh ${index + 1}`} title={images.length <= 3 ? 'Cần giữ tối thiểu 3 ảnh' : undefined}>Xóa</button></div></div></div>)}</div> : <div className="mt-4 rounded-control border border-dashed border-strong p-5 text-sm text-ink-secondary">Chưa có ảnh. Chọn ít nhất 3 ảnh cùng lúc: tổng thể, mặt sân và tiện ích.</div>}</section>;
}

async function currentUserId() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error('Phiên đăng nhập đã hết. Đăng nhập lại rồi thử tải ảnh.');
  return user.id;
}
