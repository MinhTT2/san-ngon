'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, LoaderCircle, Phone, RefreshCw } from 'lucide-react';
import { useBookingUpdates } from '@/lib/use-booking-updates';
import { OWNER_INPUT, OWNER_PRIMARY, OWNER_SECONDARY } from '@/components/owner-form-field';
import { Modal } from '@/components/modal';
import { hhmm, ymd } from '@/lib/format';

type Booking = { code: string; starts_at: string; ends_at: string; status: string; customer_name: string | null; customer_phone: string };
type Schedule = {
  date: string;
  days: { date: string; free: number; booked: number; closed: number }[];
  slots: { starts_at: string; ends_at: string; price: number; status: string }[];
  bookings: Booking[];
  closures: { id: string; starts_at: string; ends_at: string; reason: string | null }[];
};
const STATUS: Record<string, string> = { free: 'Trống', confirmed: 'Đã đặt', pending: 'Chờ cọc', completed: 'Đã chơi', cancelled: 'Đã hủy', expired: 'Hết hạn', closed: 'Đã khóa', past: 'Đã qua', unpriced: 'Chưa có giá', unavailable: 'Không nhận' };
const shortDate = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;
const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export function CourtCalendar({ courtId }: { courtId: string }) {
  const [date, setDate] = useState(() => ymd(new Date()));
  const [snapshot, setSnapshot] = useState<{ courtId: string; data: Schedule } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [partial, setPartial] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const requestRef = useRef<{ sequence: number; controller?: AbortController }>({ sequence: 0 });
  const actionRef = useRef(false);
  const dayRailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++requestRef.current.sequence;
    requestRef.current.controller = controller;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/courts/${courtId}/schedule?date=${date}`, { signal: controller.signal });
      const result = await response.json();
      if (controller.signal.aborted || requestRef.current.sequence !== sequence) return;
      if (!response.ok) throw new Error(result.error ?? 'Không tải được lịch.');
      if (!result.schedule || result.schedule.date !== date) throw new Error('Lịch chưa cập nhật được. Vui lòng thử lại.');
      setSnapshot({ courtId, data: result.schedule });
    } catch (cause) {
      if (!controller.signal.aborted && requestRef.current.sequence === sequence) {
        setError(cause instanceof Error && cause.name !== 'TypeError' ? cause.message : 'Không kết nối được. Kiểm tra mạng rồi tải lại lịch.');
      }
    } finally {
      if (!controller.signal.aborted && requestRef.current.sequence === sequence) setLoading(false);
    }
  }, [courtId, date]);
  const refresh = useCallback(() => { void load(); }, [load]);
  useEffect(() => {
    const requests = requestRef.current;
    refresh();
    return () => { requests.controller?.abort(); requests.sequence++; };
  }, [refresh]);
  useBookingUpdates(refresh, courtId);
  const schedule = snapshot?.courtId === courtId && snapshot.data.date === date ? snapshot.data : null;
  const days = snapshot?.courtId === courtId ? snapshot.data.days : [];
  useEffect(() => {
    const rail = dayRailRef.current;
    const selected = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !selected || rail.scrollWidth <= rail.clientWidth) return;
    const frame = rail.getBoundingClientRect(), item = selected.getBoundingClientRect();
    if (item.left < frame.left) rail.scrollLeft += item.left - frame.left;
    else if (item.right > frame.right) rail.scrollLeft += item.right - frame.right;
  }, [date, snapshot]);

  async function changeClosure(id?: string) {
    if (actionRef.current) return false;
    actionRef.current = true;
    setBusy(true); setActionError(''); setNotice('');
    try {
      const response = await fetch(`/api/courts/${courtId}/closures${id ? `?closure=${id}` : ''}`, id ? { method: 'DELETE' } : {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, start_time: partial ? start || null : null, end_time: partial ? end || null : null, reason: reason || null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? (id ? 'Không mở lại được lịch.' : 'Không khóa được lịch.'));
      if (!id) { setReason(''); setStart(''); setEnd(''); }
      setNotice(id ? 'Đã mở lại khoảng giờ.' : 'Đã khóa lịch. Các đơn đã đặt vẫn được giữ nguyên.');
      await load();
      return true;
    } catch (cause) {
      setActionError(cause instanceof Error && cause.name !== 'TypeError' ? cause.message : 'Không kết nối được. Kiểm tra mạng rồi thử lại.');
      return false;
    } finally { actionRef.current = false; setBusy(false); }
  }

  return <div className="mt-8 space-y-5" data-court-calendar>
    <section className="rounded-card border border-hairline bg-card p-4 lg:p-5" aria-label="Chọn ngày xem lịch">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-pitch"><CalendarDays className="size-4" aria-hidden="true" /> Chọn ngày</h2><label className="flex items-center gap-3 text-xs text-ink-secondary"><span>Đến ngày</span><input type="date" aria-label="Đến ngày" value={date} disabled={busy || closeOpen || !!selectedBooking} onChange={event => { if (event.target.value) { setDate(event.target.value); setActionError(''); setNotice(''); } }} className="h-11 min-w-0 rounded-control border border-hairline bg-page px-3 text-sm text-pitch" /></label></div>
      <div ref={dayRailRef} className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 lg:grid-cols-7">
        {days.map(day => <button key={day.date} type="button" disabled={busy || closeOpen || !!selectedBooking} aria-pressed={day.date === date} onClick={() => { setDate(day.date); setActionError(''); setNotice(''); }}
          aria-label={`${shortDate(day.date)}: ${day.free} ô trống, ${day.booked} đơn, ${day.closed} khoảng khóa`}
          className={`pf-action min-w-32 shrink-0 rounded-control border p-3 text-left transition-colors disabled:cursor-default sm:min-w-0 ${day.date === date ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline hover:border-pitch'}`}>
          <span className="block text-xs opacity-75">{weekday.format(new Date(`${day.date}T12:00:00+07:00`))}</span><span className="mt-1 block font-display text-xl font-bold">{shortDate(day.date)}</span>
          <span className="mt-3 block text-xs font-semibold">{day.free} ô trống</span><span className="mt-1 block text-xs opacity-80">{day.booked} đơn · {day.closed} khoảng khóa</span>
        </button>)}
        {!days.length && <p role="status" className="col-span-full py-4 text-sm text-ink-secondary">{loading ? 'Đang tải các ngày hoạt động…' : 'Chưa tải được danh sách ngày.'}</p>}
      </div>
    </section>

    <section className="rounded-card border border-hairline bg-card p-4 lg:p-5" aria-label="Lịch trong ngày" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl font-bold text-pitch">Lịch ngày {shortDate(date)}</h2><p className="mt-1 text-sm text-ink-secondary">Bấm khung đã đặt để xem đơn và liên hệ khách.</p></div><button type="button" disabled={loading || busy} onClick={refresh} className={`${OWNER_SECONDARY} gap-2`}><RefreshCw className={`size-4 ${loading ? 'pf-spin' : ''}`} aria-hidden="true" />{loading ? 'Đang tải…' : 'Tải lại lịch'}</button></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><Legend tone="free">Trống</Legend><Legend tone="confirmed">Đã đặt</Legend><Legend tone="pending">Chờ cọc</Legend><Legend tone="closed">Đã khóa</Legend></div>
      {error && <div role="alert" className="mt-4 rounded-control border border-danger bg-[#FFF5F5] p-4 text-sm text-danger"><p>{error}</p>{schedule && <p className="mt-1">Đang hiển thị lịch lần tải trước. Tải lại trước khi thay đổi lịch.</p>}<button type="button" onClick={refresh} disabled={loading} className="pf-action mt-2 min-h-11 font-semibold underline underline-offset-4">Thử lại</button></div>}
      {loading && !schedule && <div role="status" className="mt-5 flex min-h-40 items-center justify-center gap-3 rounded-control border border-hairline bg-page text-sm text-ink-secondary"><LoaderCircle className="pf-spin size-5" aria-hidden="true" /> Đang tải lịch ngày {shortDate(date)}…</div>}
      {schedule && <>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{schedule.slots.map(slot => {
          const booking = ['confirmed', 'pending', 'past'].includes(slot.status) ? schedule.bookings.find(item => ['confirmed', 'pending', 'completed'].includes(item.status) && Date.parse(item.starts_at) < Date.parse(slot.ends_at) && Date.parse(item.ends_at) > Date.parse(slot.starts_at)) : undefined;
          const content = <><span className="block font-semibold tabular-nums">{hhmm(slot.starts_at)}–{hhmm(slot.ends_at)}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs">{STATUS[slot.status] ?? slot.status}{booking && <ArrowUpRight className="size-3.5" aria-hidden="true" />}</span></>;
          const className = `min-h-20 rounded-slot border px-3 py-3 text-left text-sm ${slot.status === 'free' ? 'border-free-line bg-free-fill text-free-ink' : slot.status === 'confirmed' ? 'border-free-line bg-pitch text-pitch-ink' : slot.status === 'pending' ? 'border-peak-line bg-peak-fill text-peak-ink' : 'border-hairline bg-sunk text-ink-secondary'}`;
          return booking ? <button key={slot.starts_at} type="button" disabled={busy || loading || !!error} onClick={() => setSelectedBooking(booking)} aria-label={`${hhmm(slot.starts_at)}–${hhmm(slot.ends_at)}, ${STATUS[slot.status]}, xem đơn ${booking.code}`} className={`pf-action ${className}`}>{content}</button> : <div key={slot.starts_at} className={className}>{content}</div>;
        })}</div>
        {!schedule.slots.length && <p className="mt-4 rounded-control border border-dashed border-strong p-6 text-center text-sm text-ink-secondary">Ngày này không có khung hoạt động.</p>}
      </>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5"><div><h3 className="font-semibold">Khóa lịch</h3><p className="mt-1 text-sm text-ink-secondary">Tạm dừng nhận đặt cho cả ngày hoặc một khoảng giờ.</p></div><button type="button" disabled={!schedule || loading || busy || !!error} onClick={() => { setActionError(''); setCloseOpen(true); }} className={OWNER_PRIMARY}>Khóa lịch</button></div>
      {actionError && !closeOpen && <p role="alert" className="mt-3 text-sm text-danger">{actionError}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-free-ink">{notice}</p>}
      {!!schedule?.closures.length && <div className="mt-5 border-t border-hairline pt-5"><h3 className="font-semibold">Khoảng đã khóa</h3><ul className="mt-3 space-y-2">{schedule.closures.map(closure => <li key={closure.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-sunk px-3 py-2 text-sm"><span className="min-w-0 break-words">{hhmm(closure.starts_at)}–{hhmm(closure.ends_at)}{closure.reason ? ` · ${closure.reason}` : ''}</span><button type="button" disabled={busy || loading || !!error} onClick={() => changeClosure(closure.id)} className={OWNER_SECONDARY}>Mở lại</button></li>)}</ul></div>}
    </section>

    {closeOpen && <Modal title="Khóa lịch" subtitle={`Ngày ${shortDate(date)}`} size="max-w-lg" onClose={() => { if (!busy) setCloseOpen(false); }}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={partial} disabled={busy} onChange={e => setPartial(e.target.checked)} className="size-4 accent-pitch" /> Chỉ khóa một khoảng giờ</label>{partial && <><label className="text-sm font-semibold">Từ<input className={`${OWNER_INPUT} mt-1`} type="time" disabled={busy} value={start} onChange={e => setStart(e.target.value)} /></label><label className="text-sm font-semibold">Đến<input className={`${OWNER_INPUT} mt-1`} type="time" disabled={busy} value={end} onChange={e => setEnd(e.target.value)} /></label></>}<label className="text-sm font-semibold sm:col-span-2">Lý do (không bắt buộc)<input className={`${OWNER_INPUT} mt-1`} value={reason} disabled={busy} maxLength={200} onChange={e => setReason(e.target.value)} placeholder="Bảo trì, giải đấu..." /></label></div>
      {actionError && <p role="alert" className="mt-4 rounded-control border border-danger bg-[#FFF5F5] p-3 text-sm text-danger">{actionError}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={async () => { if (await changeClosure()) setCloseOpen(false); }} className={`${OWNER_PRIMARY} gap-2`}>{busy && <LoaderCircle className="pf-spin size-4" aria-hidden="true" />}{busy ? 'Đang khóa…' : partial ? 'Khóa khoảng giờ' : 'Khóa cả ngày'}</button><button type="button" disabled={busy} onClick={() => setCloseOpen(false)} className={OWNER_SECONDARY}>Hủy</button></div>
    </Modal>}

    {schedule && <section className="rounded-card border border-hairline bg-card p-4 lg:p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-pitch">Đơn trong ngày</h2><span className="rounded-pill bg-sunk px-3 py-1 text-xs text-ink-secondary">{schedule.bookings.length} đơn</span></div>{schedule.bookings.length ? <ul className="mt-3 divide-y divide-hairline">{schedule.bookings.map(booking => <li key={booking.code} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold tabular-nums">{hhmm(booking.starts_at)}–{hhmm(booking.ends_at)}</p><p className="mt-1 text-sm text-ink-secondary">{booking.customer_name ?? 'Khách'} · {STATUS[booking.status] ?? booking.status}</p></div><button type="button" disabled={busy || loading || !!error} onClick={() => setSelectedBooking(booking)} className={`${OWNER_SECONDARY} gap-2`}><span className="font-mono">{booking.code}</span><ArrowUpRight className="size-4" aria-hidden="true" /></button></li>)}</ul> : <p className="mt-3 text-sm text-ink-secondary">Chưa có đơn nào trong ngày này.</p>}</section>}

    {selectedBooking && <Modal title={`Đơn ${selectedBooking.code}`} subtitle={`Ngày ${shortDate(date)} · ${hhmm(selectedBooking.starts_at)}–${hhmm(selectedBooking.ends_at)}`} size="max-w-lg" onClose={() => setSelectedBooking(null)}>
      <span className={`inline-flex rounded-pill px-3 py-1.5 text-xs font-semibold ${selectedBooking.status === 'pending' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-pitch'}`}>{STATUS[selectedBooking.status] ?? selectedBooking.status}</span>
      <dl className="mt-5 space-y-4"><div><dt className="text-xs text-ink-secondary">Người đặt</dt><dd className="mt-1 break-words font-semibold">{selectedBooking.customer_name ?? 'Khách'}</dd></div><div><dt className="text-xs text-ink-secondary">Số điện thoại</dt><dd className="mt-1"><a href={`tel:${selectedBooking.customer_phone}`} className="pf-action inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch"><Phone className="size-4" aria-hidden="true" />{selectedBooking.customer_phone}</a></dd></div></dl>
      <p className="mt-5 text-sm leading-6 text-ink-secondary">Xác nhận cọc và xử lý hoàn tiền tại mục Đơn đặt sân.</p>
    </Modal>}
  </div>;
}

function Legend({ tone, children }: { tone: string; children: string }) {
  return <span className={`rounded-pill px-2.5 py-1.5 ${tone === 'free' ? 'bg-free-fill text-free-ink' : tone === 'confirmed' ? 'bg-pitch text-pitch-ink' : tone === 'pending' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-ink-secondary'}`}>{children}</span>;
}
