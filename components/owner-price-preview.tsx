'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';

type Preview = { date: string; rows: { starts_at: string; ends_at: string; label: string | null; priority: number | null; price: number | null }[] };
export function OwnerPricePreview({ courtId, revision }: { courtId: string; revision: string }) {
  const [date, setDate] = useState('');
  const [result, setResult] = useState<Preview | null>(null);
  const [loadedRevision, setLoadedRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  async function load(event: React.FormEvent) {
    event.preventDefault();
    const id = ++request.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const { data, error } = await createClient().rpc('get_owner_price_preview', { p_court_id: courtId, p_date: date || null });
      if (id !== request.current) return;
      if (error || !data) throw new Error('Chưa tải được giá thực tế. Vui lòng thử lại.');
      const preview = data as unknown as Preview;
      setResult(preview); setDate(preview.date); setLoadedRevision(revision);
    } catch { if (id === request.current) setError('Chưa tải được giá thực tế. Vui lòng thử lại.'); }
    finally { if (id === request.current) setBusy(false); }
  }
  return <section aria-label="Xem giá thực tế" className="mt-8 rounded-card border border-hairline bg-card p-5">
    <h2 className="font-display text-xl font-bold text-pitch">Xem giá thực tế theo ngày</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">Dùng các mức giá đã lưu. Mỗi khung lấy giá theo giờ bắt đầu; chưa tính bản nháp đang chỉnh và không thay đổi đơn cũ.</p>
    <form onSubmit={load} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Ngày áp dụng<input type="date" value={date} onChange={event => { request.current++; setBusy(false); setDate(event.target.value); setResult(null); }} className="mt-1 block h-11 rounded-control border border-hairline bg-page px-3" /></label><button disabled={busy} className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang xem giá…' : 'Xem giá đã lưu'}</button></form>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {result && loadedRevision !== revision && <p role="status" className="mt-4 text-sm text-ink-secondary">Bảng giá vừa thay đổi. Bấm Xem giá đã lưu để cập nhật bản xem trước.</p>}
    {result && loadedRevision === revision && <><p className="mt-4 text-sm font-semibold text-pitch">{dayLabel(new Date(result.date + 'T12:00:00+07:00'))} · {ymd(new Date(result.date + 'T12:00:00+07:00')).slice(0,4)}</p><ul className="mt-3 divide-y divide-hairline">{result.rows.map(row => <li key={row.starts_at} className="grid gap-2 py-3 text-sm sm:grid-cols-[120px_1fr_auto]"><strong className="tabular-nums">{hhmm(row.starts_at)}–{hhmm(row.ends_at)}</strong><span className="text-ink-secondary">{row.label ?? 'Chưa có giá'}{row.priority !== null && ' · Ưu tiên ' + row.priority}</span><strong className="text-pitch">{row.price === null ? 'Không nhận đặt' : vnd(row.price)}</strong></li>)}</ul>{!result.rows.length && <p className="mt-3 text-sm text-ink-secondary">Chưa có khung giờ để tính giá cho sân này.</p>}</>}
  </section>;
}
