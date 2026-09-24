'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OWNER_PRIMARY } from './owner-form-field';

/** Ảnh marketing của cụm sân: lưu path trong DB, file thật nằm ở bucket public. */
export function VenuePhotoManager({ venueId, initialImages }: { venueId: string; initialImages: string[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const url = (path: string) => supabase.storage.from('venue-photos').getPublicUrl(path).data.publicUrl;
  async function save(next: string[], previous = images) {
    const { error } = await supabase.rpc('set_venue_images', { p_venue_id: venueId, p_images: next, p_expected: previous });
    if (error) throw new Error(error.message.includes('IMAGES_CHANGED') ? 'Ảnh đã được cập nhật ở cửa sổ khác. Tải lại trang rồi thử lại.' : 'Cần 3–8 ảnh hợp lệ. Kiểm tra ảnh và thử lại.');
    setImages(next);
    router.refresh();
  }
  async function upload(files: FileList | null) {
    if (!files?.length || images.length >= 8) return;
    if (images.length + files.length < 3 || images.length + files.length > 8) { setMessage('Hãy chọn đủ để có tổng cộng 3–8 ảnh.'); return; }
    setBusy(true); setMessage(null);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, 8 - images.length)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Ảnh cần là JPG, PNG hoặc WebP và nhỏ hơn 5MB.');
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
        const path = `${await currentUserId()}/${venueId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('venue-photos').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error('Không tải được ảnh. Kiểm tra mạng rồi thử lại.');
        added.push(path);
      }
      await save([...images, ...added]);
      setMessage('Đã thêm ảnh. Ảnh đầu tiên là ảnh bìa.');
    } catch (error) {
      if (added.length) await supabase.storage.from('venue-photos').remove(added);
      setMessage((error as Error).message);
    } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function remove(path: string) {
    if (images.length <= 3) { setMessage('Cụm sân cần giữ tối thiểu 3 ảnh.'); return; }
    setBusy(true); setMessage(null);
    try { await save(images.filter((item) => item !== path)); await supabase.storage.from('venue-photos').remove([path]); setMessage('Đã xóa ảnh.'); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  async function cover(path: string) {
    if (path === images[0]) return;
    setBusy(true); setMessage(null);
    try { await save([path, ...images.filter((item) => item !== path)]); setMessage('Đã chọn ảnh bìa.'); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  return <section className="mt-5 rounded-control border border-hairline bg-sunk p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-pitch">Ảnh cụm sân</h3><p className="mt-1 max-w-xl text-sm leading-6 text-ink-secondary">Giữ tối thiểu 3 ảnh thật. Ảnh đầu tiên hiển thị trên danh sách tìm sân.</p></div><button type="button" disabled={busy || images.length >= 8} onClick={() => input.current?.click()} className={OWNER_PRIMARY}>{busy ? 'Đang xử lý…' : '+ Thêm ảnh'}</button><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => upload(event.target.files)} /></div>{message && <p role="status" className="mt-3 text-sm text-ink-secondary">{message}</p>}{images.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((path, index) => <div key={path} className="group relative overflow-hidden rounded-control border border-hairline bg-card"><div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${url(path)})` }} /><div className="flex items-center justify-between gap-2 p-2 text-xs"><span className="truncate">{index === 0 ? 'Ảnh bìa' : 'Ảnh sân'}</span><div className="flex gap-2"><button type="button" disabled={busy || index === 0} onClick={() => cover(path)} className="font-semibold text-pitch disabled:opacity-30">Đặt bìa</button><button type="button" disabled={busy || images.length <= 3} onClick={() => remove(path)} className="font-semibold text-danger disabled:opacity-30" title={images.length <= 3 ? 'Cần giữ tối thiểu 3 ảnh' : undefined}>Xóa</button></div></div></div>)}</div> : <div className="mt-4 rounded-control border border-dashed border-strong p-5 text-sm text-ink-secondary">Chưa có ảnh. Chọn ít nhất 3 ảnh cùng lúc: tổng thể, mặt sân và tiện ích.</div>}</section>;
}

async function currentUserId() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error('Phiên đăng nhập đã hết. Đăng nhập lại rồi thử tải ảnh.');
  return user.id;
}
