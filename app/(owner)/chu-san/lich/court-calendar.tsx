'use client';

import { useEffect, useMemo, useState } from 'react';
import { OWNER_INPUT, OWNER_PRIMARY, OWNER_SECONDARY } from '@/components/owner-form-field';
import { Modal } from '@/components/modal';
import { hhmm, ymd } from '@/lib/format';

type Schedule = { date: string; days: { date: string; free: number; booked: number; closed: number }[]; slots: { starts_at: string; ends_at: string; price: number; status: string }[]; bookings: { code: string; starts_at: string; ends_at: string; status: string; customer_name: string | null; customer_phone: string }[]; closures: { id: string; starts_at: string; ends_at: string; reason: string | null }[] };
const STATUS: Record<string, string> = { free: 'Trống', confirmed: 'Đã đặt', pending: 'Chờ cọc', closed: 'Đã khóa', past: 'Đã qua', unpriced: 'Chưa có giá', unavailable: 'Không nhận' };

export function CourtCalendar({ courtId }: { courtId: string }) {
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [partial, setPartial] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);

  async function load(nextDate = date) {
    const response = await fetch(`/api/courts/${courtId}/schedule?date=${nextDate}`);
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? 'Không tải được lịch.'); return; }
    setSchedule(result.schedule); setError('');
  }
  useEffect(() => { load(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = useMemo(() => schedule?.days ?? [], [schedule]);
  async function close() {
    setBusy(true); setError('');
    const response = await fetch(`/api/courts/${courtId}/closures`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, start_time: partial ? start || null : null, end_time: partial ? end || null : null, reason: reason || null }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(result.error ?? 'Không khóa được lịch.'); return false; }
    setReason(''); setStart(''); setEnd(''); await load(); return true;
  }
  async function reopen(id: string) {
    setBusy(true);
    const response = await fetch(`/api/courts/${courtId}/closures?closure=${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) { setError('Không mở lại được lịch.'); return; }
    await load();
  }
  const selectedDay = days.find((item) => item.date === date);
  return <div className="mt-8 space-y-6">
    {error && <p role="alert" className="rounded-card border border-danger bg-[#FFF5F5] px-4 py-3 text-sm text-danger">{error}</p>}
    <section className="rounded-card border border-hairline bg-card p-4 lg:p-5">
      <h2 className="font-semibold text-pitch">Chọn ngày</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => <button key={day.date} type="button" onClick={() => setDate(day.date)} className={`rounded-control border p-3 text-left ${day.date === date ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline'}`}><span className="block text-xs opacity-75">{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${day.date}T12:00:00+07:00`))}</span><span className="font-semibold">{day.date.slice(8)}/{day.date.slice(5, 7)}</span><span className="mt-1 block text-[11px] opacity-80">{day.closed ? `${day.closed} ô khóa` : `${day.free} ô trống · ${day.booked} đơn`}</span></button>)}
      </div>
    </section>
    <section className="rounded-card border border-hairline bg-card p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-pitch">Lịch ngày {date.slice(8)}/{date.slice(5, 7)}</h2><p className="mt-1 text-sm text-ink-secondary">Bấm khóa cả ngày nếu sân nghỉ. Có thể khóa riêng một khoảng giờ.</p></div><div className="flex flex-wrap gap-2 text-xs"><Legend tone="free">Trống</Legend><Legend tone="confirmed">Đã đặt</Legend><Legend tone="pending">Chờ cọc</Legend><Legend tone="closed">Đã khóa</Legend></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{schedule?.slots.map((slot) => <div key={slot.starts_at} className={`rounded-slot border px-3 py-2 text-sm ${slot.status === 'free' ? 'border-free-line bg-free-fill text-free-ink' : slot.status === 'confirmed' ? 'border-free-line bg-pitch text-pitch-ink' : slot.status === 'pending' ? 'border-peak-line bg-peak-fill text-peak-ink' : 'border-hairline bg-sunk text-ink-secondary'}`}><span className="font-semibold">{hhmm(slot.starts_at)}–{hhmm(slot.ends_at)}</span><span className="ml-2 text-xs">{STATUS[slot.status] ?? slot.status}</span></div>)}</div>
      {!schedule?.slots.length && <p className="mt-4 rounded-control border border-dashed border-strong p-6 text-center text-sm text-ink-secondary">Ngày này không có khung hoạt động.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5"><div><h3 className="font-semibold">Khóa lịch</h3><p className="mt-1 text-sm text-ink-secondary">Tạm dừng nhận đặt cho cả ngày hoặc một khoảng giờ.</p></div><button type="button" onClick={() => setCloseOpen(true)} className={OWNER_PRIMARY}>Khóa lịch</button></div>
      {!!schedule?.closures.length && <div className="mt-5 border-t border-hairline pt-5"><h3 className="font-semibold">Khoảng đã khóa</h3><ul className="mt-2 space-y-2">{schedule.closures.map((closure) => <li key={closure.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-sunk px-3 py-2 text-sm"><span>{hhmm(closure.starts_at)}–{hhmm(closure.ends_at)}{closure.reason ? ` · ${closure.reason}` : ''}</span><button type="button" disabled={busy} onClick={() => reopen(closure.id)} className={OWNER_SECONDARY}>Mở lại</button></li>)}</ul></div>}
    </section>
    {closeOpen && <Modal title="Khóa lịch" subtitle={`Ngày ${date.slice(8)}/${date.slice(5, 7)}`} onClose={() => setCloseOpen(false)}><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> Chỉ khóa một khoảng giờ</label>{partial && <><label className="text-sm font-semibold">Từ<input className={`${OWNER_INPUT} mt-1`} type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label><label className="text-sm font-semibold">Đến<input className={`${OWNER_INPUT} mt-1`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label></>}<label className="text-sm font-semibold sm:col-span-2">Lý do (không bắt buộc)<input className={`${OWNER_INPUT} mt-1`} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Bảo trì, giải đấu..." /></label></div><div className="mt-5 flex gap-2"><button type="button" disabled={busy} onClick={async () => { if (await close()) setCloseOpen(false); }} className={OWNER_PRIMARY}>{partial ? 'Khóa khoảng giờ' : 'Khóa cả ngày'}</button><button type="button" onClick={() => setCloseOpen(false)} className={OWNER_SECONDARY}>Hủy</button></div></Modal>}
    <section className="rounded-card border border-hairline bg-card p-4 lg:p-5"><h2 className="font-semibold text-pitch">Đơn trong ngày</h2>{schedule?.bookings.length ? <ul className="mt-3 divide-y divide-hairline">{schedule.bookings.map((booking) => <li key={booking.code} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-semibold">{hhmm(booking.starts_at)}–{hhmm(booking.ends_at)} · {booking.customer_name ?? 'Khách'}</span><span className="text-sm text-ink-secondary">{booking.code} · {booking.customer_phone} · {STATUS[booking.status] ?? booking.status}</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-secondary">Chưa có đơn nào trong ngày này.</p>}</section>
    {selectedDay?.closed ? <p className="text-xs text-ink-secondary">Ngày này có {selectedDay.closed} khung đang khóa. Khách sẽ không thấy và không thể đặt các khung đó.</p> : null}
  </div>;
}

function Legend({ tone, children }: { tone: string; children: string }) { return <span className={`rounded-pill px-2 py-1 ${tone === 'free' ? 'bg-free-fill text-free-ink' : tone === 'confirmed' ? 'bg-pitch text-pitch-ink' : tone === 'pending' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-ink-secondary'}`}>{children}</span>; }
