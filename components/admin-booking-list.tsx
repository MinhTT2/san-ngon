'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/modal';
import { StatusBadge } from '@/components/status-badge';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import type { AdminBooking } from '@/lib/admin-bookings';

function dateLabel(value: string) {
  const date = new Date(value);
  return `${dayLabel(date)}/${ymd(date).slice(0,4)}`;
}

function BookingStatus({ booking: b }: { booking: AdminBooking }) {
  return <div className="flex flex-wrap gap-1.5">{b.hold_expired ? <span className="rounded-pill bg-sunk px-2.5 py-1 text-xs font-medium text-ink-secondary">Hết hạn giữ chỗ</span> : b.is_playing ? <span className="rounded-pill bg-free-fill px-2.5 py-1 text-xs font-medium text-pitch">Đang chơi</span> : <StatusBadge status={b.status} />}{b.refund_status === 'needed' && <span className="rounded-pill bg-peak-fill px-2.5 py-1 text-xs font-medium text-peak-ink">Chờ hoàn cọc</span>}{b.refund_status === 'done' && <span className="rounded-pill bg-sunk px-2.5 py-1 text-xs font-medium text-ink-secondary">Đã hoàn cọc</span>}</div>;
}

export function AdminBookingList({ bookings }: { bookings: AdminBooking[] }) {
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const detail = (b: AdminBooking) => <button type="button" aria-label={`Chi tiết đơn ${b.code}`} aria-haspopup="dialog" onClick={() => setSelected(b)} className="pf-action inline-flex min-h-11 items-center rounded-control border border-hairline px-3 text-xs font-semibold text-pitch hover:border-strong">Chi tiết</button>;
  const money = (b: AdminBooking) => <><p className="font-semibold tabular-nums text-pitch">{vnd(b.total_amount)}</p><p className="mt-1 text-xs text-ink-secondary">Cọc {vnd(b.deposit_amount)}</p></>;
  const time = (b: AdminBooking) => <><p className="font-semibold tabular-nums text-pitch">{hhmm(b.starts_at)} – {hhmm(b.ends_at)}</p><p className="mt-1 text-xs text-ink-secondary">{dateLabel(b.starts_at)}</p>{b.status === 'pending' && !b.hold_expired && <p className="mt-1 text-xs text-peak-ink">Hạn cọc {hhmm(b.expires_at)} · {dateLabel(b.expires_at)}</p>}</>;
  return <>
    <div className="hidden xl:block"><table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Thông tin khách, sân, giờ chơi và tiền cọc</caption><thead className="bg-page text-[11px] text-ink-secondary"><tr className="border-b border-hairline">{['Khách / Mã đơn','Cụm sân / Sân con','Giờ chơi','Tiền sân','Trạng thái',''].map((label,i) => <th key={i} scope="col" className={`px-4 py-3 font-semibold ${i === 5 ? 'w-24' : ''}`}>{label || <span className="sr-only">Chi tiết</span>}</th>)}</tr></thead><tbody>{bookings.map(b => <tr key={b.id} className="border-b border-hairline align-top last:border-0 hover:bg-page"><td className="break-words px-4 py-4"><p className="font-semibold">{b.customer_name || 'Khách đặt sân'}</p><a href={`tel:${b.customer_phone}`} className="mt-1 inline-block text-xs tabular-nums text-ink-secondary underline underline-offset-4">{b.customer_phone}</a><p className="mt-2 font-mono text-[11px] text-pitch">{b.code}</p></td><td className="break-words px-4 py-4"><p className="font-semibold text-pitch">{b.venue_name}</p><p className="mt-1 text-xs text-ink-secondary">{b.court_name}</p></td><td className="px-4 py-4">{time(b)}</td><td className="px-4 py-4">{money(b)}</td><td className="px-4 py-4"><BookingStatus booking={b} /></td><td className="px-3 py-3">{detail(b)}</td></tr>)}</tbody></table></div>
    <ul className="divide-y divide-hairline xl:hidden">{bookings.map(b => <li key={b.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-pitch">{b.customer_name || 'Khách đặt sân'}</p><p className="mt-1 font-mono text-xs text-ink-secondary">{b.code}</p></div><BookingStatus booking={b} /></div><p className="mt-4 break-words text-sm font-semibold text-pitch">{b.venue_name} · {b.court_name}</p><div className="mt-2 flex flex-wrap justify-between gap-3 text-sm"><div>{time(b)}</div><div>{money(b)}</div></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3"><a href={`tel:${b.customer_phone}`} className="inline-flex min-h-11 items-center text-sm tabular-nums text-pitch underline underline-offset-4">{b.customer_phone}</a>{detail(b)}</div></li>)}</ul>
    {selected && <Modal title={`Đơn ${selected.code}`} subtitle={`${selected.venue_name} · ${selected.court_name}`} onClose={() => setSelected(null)} size="max-w-2xl">
      <BookingStatus booking={selected} />
      <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-ink-secondary">Khách đặt sân</dt><dd className="mt-1 break-words font-semibold">{selected.customer_name || 'Khách đặt sân'}</dd><dd><a href={`tel:${selected.customer_phone}`} className="mt-1 inline-flex min-h-11 items-center text-pitch underline underline-offset-4">{selected.customer_phone}</a></dd></div><div><dt className="text-xs text-ink-secondary">Giờ chơi</dt><dd className="mt-1">{time(selected)}</dd></div><div><dt className="text-xs text-ink-secondary">Tiền sân / Cọc</dt><dd className="mt-1">{money(selected)}</dd></div><div><dt className="text-xs text-ink-secondary">Chủ sân phụ trách</dt><dd className="mt-1 break-words font-semibold">{selected.owner_name || 'Chưa có tên'}</dd>{selected.owner_phone && <dd><a href={`tel:${selected.owner_phone}`} className="mt-1 inline-flex min-h-11 items-center text-pitch underline underline-offset-4">{selected.owner_phone}</a></dd>}<dd><Link href={`/admin/owners/${selected.owner_id}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-pitch underline underline-offset-4">Xem hồ sơ chủ sân</Link></dd></div></dl>
      <div className="mt-5 border-t border-hairline pt-4"><h3 className="text-sm font-semibold text-pitch">Mốc xử lý</h3><dl className="mt-3 space-y-2 text-xs leading-6">{[['Tạo đơn',selected.created_at],['Hạn giữ chỗ',selected.expires_at],['Đã nhận cọc',selected.paid_at],['Đã hủy',selected.cancelled_at]].map(([label,value]) => value && <div key={label} className="flex flex-wrap justify-between gap-x-4"><dt className="text-ink-secondary">{label}</dt><dd>{dateLabel(value)} · {hhmm(value)}</dd></div>)}</dl></div>
      {selected.note && <div className="mt-4 rounded-control border border-hairline bg-page p-4"><h3 className="text-xs font-semibold text-ink-secondary">Ghi chú của khách</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{selected.note}</p></div>}
      {selected.refund_status === 'needed' && <p className="mt-4 rounded-control border border-peak-line bg-peak-fill p-4 text-sm leading-6 text-peak-ink">Chủ sân cần chuyển hoàn {vnd(selected.deposit_amount)} cho khách và đánh dấu đã hoàn trong trang quản lý đơn.</p>}
    </Modal>}
  </>;
}
