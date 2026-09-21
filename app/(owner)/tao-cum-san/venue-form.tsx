'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISTRICTS, SPORT_LABELS } from '@/lib/constants';

type SportRow = { sport: string; courtCount: string; price: string };
const SPORT_KEYS = Object.keys(SPORT_LABELS).filter((key) => key !== 'tennis');
const INPUT = 'h-12 w-full rounded-control border border-hairline bg-page px-3.5 text-[15px] outline-none focus:border-pitch focus:ring-2 focus:ring-strong';

export function VenueForm({ defaultPhone }: { defaultPhone?: string | null }) {
  const router = useRouter();
  const [sports, setSports] = useState<SportRow[]>([{ sport: 'football5', courtCount: '4', price: '250000' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const update = (index: number, patch: Partial<SportRow>) => setSports((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addSport = () => { const next = SPORT_KEYS.find((key) => !sports.some((item) => item.sport === key)); if (next) setSports((current) => [...current, { sport: next, courtCount: '2', price: '150000' }]); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''), address: String(form.get('address') ?? ''), district: String(form.get('district') ?? ''),
      phone: String(form.get('phone') ?? ''), description: String(form.get('description') ?? ''), open_time: String(form.get('open_time') ?? ''), close_time: String(form.get('close_time') ?? ''),
      sports: sports.map((item) => ({ sport: item.sport, court_count: Number(item.courtCount), price_per_hour: Number(item.price) })),
    };
    try {
      const response = await fetch('/api/venues', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? 'Không tạo được cụm sân.'); return; }
      router.push('/chu-san'); router.refresh();
    } catch { setError('Không kết nối được. Kiểm tra mạng rồi thử lại.'); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="rounded-card border border-hairline bg-card p-5 sm:p-8"><div className="grid gap-4 sm:grid-cols-2"><Field label="Tên cụm sân" name="name"><input name="name" required minLength={3} maxLength={120} placeholder="Ví dụ: Sân bóng Mỹ Đình" className={INPUT} /></Field><Field label="Số điện thoại tại sân" name="phone"><input name="phone" required pattern="0\d{9}" defaultValue={defaultPhone ?? ''} placeholder="0987654321" className={INPUT} /></Field></div><div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]"><Field label="Địa chỉ" name="address"><input name="address" required minLength={3} maxLength={200} placeholder="Số nhà, đường, phường/xã" className={INPUT} /></Field><Field label="Quận/huyện" name="district"><select name="district" required defaultValue="" className={INPUT}><option value="" disabled>Chọn quận/huyện</option>{DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select></Field></div><div className="mt-4"><Field label="Giới thiệu ngắn" name="description"><textarea name="description" rows={3} maxLength={500} className={`${INPUT} h-auto py-3`} placeholder="Ví dụ: cỏ nhân tạo, có mái che…" /></Field></div><div className="mt-8 border-t border-hairline pt-7"><h2 className="font-display text-xl font-bold text-pitch">Môn thể thao và giá khởi điểm</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">Bạn có thể chỉnh bảng giá chi tiết sau.</p><div className="mt-5 flex flex-col gap-3">{sports.map((item, index) => <div key={`${item.sport}-${index}`} className="rounded-control border border-hairline bg-sunk p-4"><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px_180px_auto] sm:items-end"><Field label="Môn thể thao" name={`sport-${index}`}><select value={item.sport} onChange={(event) => update(index, { sport: event.target.value })} className={INPUT}>{SPORT_KEYS.map((key) => <option key={key} value={key} disabled={sports.some((other, i) => i !== index && other.sport === key)}>{SPORT_LABELS[key]}</option>)}</select></Field><Field label="Số sân" name={`court-${index}`}><input type="number" min={1} max={20} required value={item.courtCount} onChange={(event) => update(index, { courtCount: event.target.value })} className={INPUT} /></Field><Field label="Giá / giờ" name={`price-${index}`}><input type="number" min={1000} max={10000000} step={1000} required value={item.price} onChange={(event) => update(index, { price: event.target.value })} className={INPUT} /></Field>{sports.length > 1 && <button type="button" onClick={() => setSports((current) => current.filter((_, i) => i !== index))} className="h-12 text-sm text-ink-secondary underline hover:text-danger">Xóa</button>}</div></div>)}</div>{sports.length < SPORT_KEYS.length && <button type="button" onClick={addSport} className="mt-4 rounded-control border border-hairline px-4 py-3 text-sm font-semibold text-pitch">+ Thêm môn khác</button>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Mở cửa từ" name="open_time"><input name="open_time" type="time" required defaultValue="05:00" className={INPUT} /></Field><Field label="Đóng cửa lúc" name="close_time"><input name="close_time" type="time" required defaultValue="23:00" className={INPUT} /></Field></div></div>{error && <p role="alert" className="mt-6 border-l-2 border-danger bg-[#FFF5F5] px-4 py-3 text-sm text-danger">{error}</p>}<div className="mt-8 flex justify-end border-t border-hairline pt-6"><button disabled={busy} className="min-h-13 rounded-control bg-pitch px-7 font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang tạo…' : 'Tạo cụm sân'} <span aria-hidden="true" className="ml-3">→</span></button></div></form>;
}

function Field({ label, children }: { label: string; name: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1.5 text-sm font-semibold">{label}{children}</label>; }
