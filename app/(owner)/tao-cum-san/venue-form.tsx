'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISTRICTS, SPORT_LABELS } from '@/lib/constants';
import { OWNER_INPUT, OWNER_PRIMARY, OWNER_SECONDARY, OwnerField } from '@/components/owner-form-field';
import { createClient } from '@/lib/supabase/client';
import { Check, ImagePlus, X } from 'lucide-react';

type SportRow = { sport: string; courtCount: string; price: string };
const SPORT_KEYS = Object.keys(SPORT_LABELS);
const EMPTY: SportRow = { sport: 'football5', courtCount: '1', price: '250000' };

type Errors = Record<string, string>;
export function VenueForm({ defaultPhone, embedded = false, onSuccess }: { defaultPhone?: string | null; embedded?: boolean; onSuccess?: (venueId?: string) => void }) {
  const router = useRouter();
  const firstField = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [sports, setSports] = useState<SportRow[]>([EMPTY]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState({ name: '', address: '', district: '', phone: defaultPhone ?? '', description: '', open_time: '05:00', close_time: '23:00' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const draftId = useRef<string | null>(null);
  const uploaded = useRef(new Map<File, string>());
  const photoInput = useRef<HTMLInputElement>(null);
  const updateDetails = (key: keyof typeof details, value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const updateSport = (index: number, patch: Partial<SportRow>) => setSports((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addSport = () => { const next = SPORT_KEYS.find((key) => !sports.some((item) => item.sport === key)); if (next) setSports((current) => [...current, { sport: next, courtCount: '1', price: '150000' }]); };
  const totalCourts = sports.reduce((sum, item) => sum + (Number(item.courtCount) || 0), 0);
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPhotoUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  function goToSetup(event: React.FormEvent) {
    event.preventDefault(); setError(null); setFieldErrors({});
    if (details.close_time <= details.open_time) { setFieldErrors({ close_time: 'Giờ đóng cửa phải sau giờ mở cửa.' }); return; }
    setStep(2);
  }
  function choosePhotos(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { setError('Ảnh cần là JPG, PNG hoặc WebP và nhỏ hơn 5MB.'); return; }
    if (photos.length + incoming.length > 8) { setError('Tối đa 8 ảnh. Hãy chọn ít ảnh hơn.'); return; }
    const next = [...photos, ...incoming];
    setPhotos(next); setError(null);
  }
  function removePhoto(index: number) {
    const next = photos.filter((_, item) => item !== index);
    setPhotos(next);
  }
  async function submit() {
    setBusy(true); setError(null); setFieldErrors({});
    if (totalCourts < 1 || totalCourts > 20) { setError('Tổng số sân con phải từ 1 đến 20 sân.'); setBusy(false); return; }
    if (photos.length < 3) { setError('Hãy thêm ít nhất 3 ảnh thật của cụm sân.'); setBusy(false); return; }
    const payload = { ...details, sports: sports.map((item) => ({ sport: item.sport, court_count: Number(item.courtCount), price_per_hour: Number(item.price) })) };
    try {
      const supabase = createClient();
      if (!draftId.current) {
        const response = await fetch('/api/venues', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) { setError(result.error ?? 'Không tạo được cụm sân.'); setFieldErrors(result.fieldErrors ?? {}); return; }
        draftId.current = result.venue.id;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Bạn cần đăng nhập lại để tải ảnh. Bản nháp vẫn được giữ trong Quản lý sân.');
      for (const photo of photos) {
        if (uploaded.current.has(photo)) continue;
        const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type.split('/')[1];
        const path = `${user.id}/${draftId.current}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from('venue-photos').upload(path, photo, { contentType: photo.type, upsert: false });
        if (error) throw new Error('Chưa tải hết ảnh. Bấm thử lại để tiếp tục; bản nháp đã được giữ trong Quản lý sân.');
        uploaded.current.set(photo, path);
      }
      const paths = photos.map((photo) => uploaded.current.get(photo)!);
      const { error: publishError } = await supabase.rpc('set_venue_images', { p_venue_id: draftId.current, p_images: paths, p_expected: [] });
      if (publishError) {
        // A lost response may follow a successful publish. Verify before retrying.
        const { data: saved } = await supabase.from('venues').select('images, status').eq('id', draftId.current!).single();
        if (saved?.status !== 'active' || JSON.stringify(saved.images) !== JSON.stringify(paths)) throw new Error('Chưa công khai được cụm sân. Bản nháp và ảnh đã tải vẫn được giữ để thử lại.');
      }
      const result = { venue: { id: draftId.current } };
      if (onSuccess) onSuccess(result.venue.id ?? undefined);
      else { router.push(`/chu-san/quan-ly?venue=${result.venue?.id ?? ''}`); router.refresh(); }
    } catch (error) { setError(error instanceof Error ? error.message : 'Không kết nối được. Kiểm tra mạng rồi thử lại.'); }
    finally { setBusy(false); }
  }

  return <div className={embedded ? '' : 'rounded-card border border-hairline bg-card p-5 sm:p-8'}>
    <div className="mb-8 flex items-center gap-3 text-sm"><Step number={1} active={step === 1} done={step > 1} label="Thông tin cụm" /><span className="h-px flex-1 bg-hairline" /><Step number={2} active={step === 2} done={step > 2} label="Thiết lập sân" /><span className="h-px flex-1 bg-hairline" /><Step number={3} active={step === 3} done={false} label="Thêm ảnh" /></div>
    {step === 1 ? <form onSubmit={goToSetup}>
      <div className="grid gap-4 sm:grid-cols-2"><OwnerField label="Tên cụm sân" error={fieldErrors.name}><input ref={firstField} className={OWNER_INPUT} value={details.name} onChange={(e) => updateDetails('name', e.target.value)} placeholder="Ví dụ: Sân bóng Mỹ Đình" required maxLength={120} /></OwnerField><OwnerField label="Số điện thoại tại sân" error={fieldErrors.phone}><input className={OWNER_INPUT} value={details.phone} onChange={(e) => updateDetails('phone', e.target.value)} placeholder="0987654321" required pattern="0\d{9}" /></OwnerField></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]"><OwnerField label="Địa chỉ" error={fieldErrors.address}><input className={OWNER_INPUT} value={details.address} onChange={(e) => updateDetails('address', e.target.value)} placeholder="Số nhà, đường, phường/xã" required maxLength={200} /></OwnerField><OwnerField label="Quận/huyện" error={fieldErrors.district}><select className={OWNER_INPUT} value={details.district} onChange={(e) => updateDetails('district', e.target.value)} required><option value="" disabled>Chọn quận/huyện</option>{DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select></OwnerField></div>
      <div className="mt-4"><OwnerField label="Giới thiệu ngắn"><textarea className={`${OWNER_INPUT} h-auto py-3`} rows={3} maxLength={500} value={details.description} onChange={(e) => updateDetails('description', e.target.value)} placeholder="Ví dụ: cỏ nhân tạo, có mái che…" /></OwnerField></div>
      <div className="mt-8 border-t border-hairline pt-7"><h2 className="font-display text-xl font-bold text-pitch">Giờ hoạt động chung</h2><p className="mt-2 text-sm text-ink-secondary">Sân con sẽ dùng giờ này nếu bạn không đặt giờ riêng.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><OwnerField label="Mở cửa từ" error={fieldErrors.open_time}><input type="time" className={OWNER_INPUT} value={details.open_time} onChange={(e) => updateDetails('open_time', e.target.value)} required /></OwnerField><OwnerField label="Đóng cửa lúc" error={fieldErrors.close_time}><input type="time" className={OWNER_INPUT} value={details.close_time} onChange={(e) => updateDetails('close_time', e.target.value)} required /></OwnerField></div></div>
      <div className="mt-8 flex justify-end border-t border-hairline pt-6"><button className={OWNER_PRIMARY}>Tiếp tục thiết lập sân <span aria-hidden="true" className="ml-3">→</span></button></div>
    </form> : step === 2 ? <div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-pitch">Môn thể thao và giá khởi điểm</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">Hệ thống sẽ tạo tên Sân 1, Sân 2… Bạn có thể đổi tên và chỉnh giá sau.</p></div><span className={`rounded-pill px-3 py-1 text-sm ${totalCourts > 20 ? 'bg-[#FFF5F5] text-danger' : 'bg-sunk text-ink-secondary'}`}>{totalCourts}/20 sân</span></div>
      <div className="mt-5 flex flex-col gap-3">{sports.map((item, index) => <div key={`${item.sport}-${index}`} className="rounded-control border border-hairline bg-sunk p-4"><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px_180px_auto] sm:items-end"><OwnerField label="Môn thể thao" error={fieldErrors[`sports.${index}.sport`]}><select className={OWNER_INPUT} value={item.sport} onChange={(e) => updateSport(index, { sport: e.target.value })}>{SPORT_KEYS.map((key) => <option key={key} value={key} disabled={sports.some((other, i) => i !== index && other.sport === key)}>{SPORT_LABELS[key]}</option>)}</select></OwnerField><OwnerField label="Số sân" error={fieldErrors[`sports.${index}.court_count`]}><input className={OWNER_INPUT} type="number" min={1} max={20} required value={item.courtCount} onChange={(e) => updateSport(index, { courtCount: e.target.value })} /></OwnerField><OwnerField label="Giá / giờ" error={fieldErrors[`sports.${index}.price_per_hour`]}><input className={OWNER_INPUT} type="number" min={1000} max={10000000} step={1000} required value={item.price} onChange={(e) => updateSport(index, { price: e.target.value })} /></OwnerField>{sports.length > 1 && <button type="button" onClick={() => setSports((current) => current.filter((_, i) => i !== index))} className="h-12 text-sm text-ink-secondary underline hover:text-danger">Xóa</button>}</div></div>)}</div>
      {sports.length < SPORT_KEYS.length && <button type="button" onClick={addSport} className={OWNER_SECONDARY + ' mt-4'}>+ Thêm môn khác</button>}
      <div className="mt-6 rounded-control border border-hairline bg-sunk p-4 text-sm"><p className="font-semibold text-pitch">Tóm tắt</p><p className="mt-2 text-ink-secondary">{details.name || 'Chưa đặt tên'} · {details.district || 'Chưa chọn quận/huyện'} · {details.open_time}–{details.close_time}</p>{sports.map((item) => <p key={item.sport} className="mt-1 text-ink-secondary">{SPORT_LABELS[item.sport]}: {item.courtCount} sân · {Number(item.price || 0).toLocaleString('vi-VN')}đ/giờ</p>)}<p className="mt-3 text-xs text-ink-secondary">Giá chung áp dụng mỗi ngày, khung 60 phút. Bạn có thể chỉnh sau.</p></div>
      {error && <p role="alert" className="mt-6 border-l-2 border-danger bg-[#FFF5F5] px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-hairline pt-6"><button type="button" onClick={() => { setStep(1); setTimeout(() => firstField.current?.focus(), 0); }} className={OWNER_SECONDARY}>← Quay lại</button><button type="button" onClick={() => { if (totalCourts < 1 || totalCourts > 20) { setError('Tổng số sân con phải từ 1 đến 20 sân.'); return; } setError(null); setStep(3); }} disabled={busy} className={OWNER_PRIMARY}>Tiếp tục thêm ảnh <span aria-hidden="true" className="ml-3">→</span></button></div>
    </div> : <div>
      <div><h2 className="font-display text-xl font-bold text-pitch">Ảnh thật của cụm sân</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">Thêm tối thiểu 3 ảnh: ảnh bìa, mặt sân và một góc tiện ích. Ảnh đầu tiên sẽ xuất hiện trên thẻ tìm sân.</p></div>
      <div className="mt-5 rounded-control border-2 border-dashed border-strong bg-sunk p-4"><button type="button" disabled={busy || photos.length >= 8} onClick={() => photoInput.current?.click()} className="flex w-full flex-col items-center justify-center rounded-control border border-transparent bg-card px-4 py-8 text-center transition-colors hover:border-pitch"><span className="flex size-12 items-center justify-center rounded-full bg-free-fill text-free-ink"><ImagePlus className="size-6" aria-hidden="true" /></span><span className="mt-3 text-sm font-semibold text-pitch">Chọn ảnh từ thiết bị</span><span className="mt-1 text-xs text-ink-secondary">JPG, PNG hoặc WebP · tối đa 5MB/ảnh · {photos.length}/8 ảnh</span></button><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { if (event.target.files) choosePhotos(event.target.files); event.target.value = ''; }} /></div>
      {photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo, index) => <div key={`${photo.name}-${index}`} className="overflow-hidden rounded-control border border-hairline bg-card"><div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${photoUrls[index]})` }} /><div className="flex items-center justify-between gap-2 p-2"><span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-pitch">{index === 0 && <Check className="size-3.5" aria-hidden="true" />}<span className="truncate">{index === 0 ? 'Ảnh bìa' : <button type="button" disabled={busy} onClick={() => { setPhotos([photo, ...photos.filter((_, i) => i !== index)]);  }}>Đặt làm bìa</button>}</span></span><button type="button" disabled={busy} onClick={() => removePhoto(index)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-sunk hover:text-danger" aria-label={`Xóa ảnh ${index + 1}`}><X className="size-4" /></button></div></div>)}</div>}
      <div className="mt-5 rounded-control border border-strong bg-free-fill p-4 text-sm leading-6 text-free-ink"><p className="font-semibold">Vì sao cần 3 ảnh?</p><p className="mt-1">Người chơi thường quyết định dựa vào mặt sân, ánh sáng và tiện ích. Ảnh thật giúp cụm sân nổi bật và tạo tin tưởng hơn.</p></div>
      {error && <p role="alert" className="mt-6 border-l-2 border-danger bg-[#FFF5F5] px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-hairline pt-6"><button type="button" disabled={busy || !!draftId.current} onClick={() => setStep(2)} className={OWNER_SECONDARY}>← Quay lại</button><button type="button" onClick={submit} disabled={busy || photos.length < 3} className={OWNER_PRIMARY}>{busy ? 'Đang tải ảnh…' : 'Tạo cụm và mở nhận đặt'} <span aria-hidden="true" className="ml-3">→</span></button></div>
    </div>}
  </div>;
}
function Step({ number, active, done, label }: { number: number; active: boolean; done: boolean; label: string }) { return <div className={`flex items-center gap-2 ${active || done ? 'font-semibold text-pitch' : 'text-ink-secondary'}`}><span className={`grid h-8 w-8 place-items-center rounded-full border text-sm ${active || done ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline'}`}>{done ? '✓' : number}</span><span className="hidden sm:inline">{label}</span></div>; }
