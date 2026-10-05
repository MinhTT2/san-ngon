'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { registrationLabel } from '@/lib/tournament-status';
import type { Registration } from '@/lib/tournaments';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { ActionForm } from './action-form';
import { Field, fieldClass } from './form-field';
import { TournamentReviewRegistration } from './tournament-review-registration';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');

export function TournamentParticipants({ registrations, closed, started, canCancel, userId, admin }: {
  registrations: Registration[]; closed: boolean; started: boolean; canCancel: boolean; userId: string; admin: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const matching = registrations.filter(registration => {
    const category = registration.status === 'approved' ? registration.paid_at || registration.deposit_amount === 0 ? 'confirmed' : 'unpaid' : registration.status;
    return (filter === 'all' || category === filter) && normalize(`${registration.full_name} ${registration.team_name ?? ''} ${registration.phone}`).includes(normalize(search.trim()));
  });
  return <section id="nguoi-tham-gia" className="scroll-mt-28 py-6">
    <h2 className="font-display text-2xl font-bold text-pitch">Người tham gia</h2>
    <div className="my-5 grid items-end gap-4 sm:grid-cols-[1fr_240px]">
      <Field label="Tìm người hoặc đội"><span className="relative"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-ink-secondary" /><input className={`${fieldClass} pl-10`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Họ tên, tên đội, số điện thoại" /></span></Field>
      <Field label="Trạng thái đăng ký"><select className={fieldClass} value={filter} onChange={event => setFilter(event.target.value)}>{[['all', 'Tất cả'], ['pending', 'Chờ duyệt'], ['unpaid', 'Chờ đóng cọc'], ['confirmed', 'Đã xác nhận tham gia'], ['expired', 'Hết hạn'], ['rejected', 'Không được duyệt'], ['cancelled', 'Đã hủy']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    </div>
    <p role="status" className="mb-4 text-xs text-ink-secondary">{matching.length} / {registrations.length} đăng ký</p>
    <div className="space-y-3">{matching.map(registration => {
      const confirmed = registration.status === 'approved' && (registration.paid_at || registration.deposit_amount === 0);
      const canHandleMoney = admin || registration.payment_owner_id === userId;
      const self = registration.user_id === userId;
      return <details key={registration.id} open={registration.status === 'pending'} className="rounded-card border border-hairline bg-card">
        <summary className="cursor-pointer px-5 py-4 marker:text-pitch">
          <span className="ml-1 inline-flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 align-middle">
            <span className="break-words font-semibold">{registration.full_name}{registration.team_name && ` · ${registration.team_name}`}</span>
            <span className={`text-xs font-semibold ${registration.status === 'pending' || (registration.status === 'approved' && !confirmed) ? 'text-peak-ink' : 'text-ink-secondary'}`}>{registrationLabel(registration)}</span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-hairline p-5">
          <p className="break-words text-sm"><a className="font-semibold text-pitch underline" href={`tel:${registration.phone}`}>{registration.phone}</a> · {registration.address}</p>
          {registration.note && <p className="whitespace-pre-wrap break-words text-sm text-ink-secondary">{registration.note}</p>}
          {registration.review_note && <p className="break-words text-sm text-ink-secondary">Ghi chú duyệt: {registration.review_note}</p>}
          <p className="text-sm">{registration.paid_at ? `Đã nhận cọc ${vnd(registration.deposit_amount)}` : registration.deposit_amount === 0 ? 'Không yêu cầu cọc' : registration.status === 'pending' ? 'Chưa cần đóng cọc' : 'Chưa nhận đủ cọc'}{registration.status === 'approved' && !confirmed && registration.payment_expires_at && ` · Hạn: ${dayLabel(new Date(registration.payment_expires_at))} · ${hhmm(registration.payment_expires_at)}`}</p>
          {registration.status === 'pending' && !closed && <TournamentReviewRegistration id={registration.id} />}
          {registration.status === 'approved' && canCancel && (!self || !started) && <ActionForm payload={{ action: 'cancel_registration', id: registration.id }} variant="danger" label={self ? 'Hủy đăng ký của bạn' : 'Hủy suất tham gia'} confirmMessage={self ? `Đây là đăng ký của bạn, áp dụng chính sách tự hủy. ${registration.refund_deadline ? `Chỉ hoàn cọc nếu hủy không muộn hơn ${dayLabel(new Date(registration.refund_deadline))} · ${hhmm(registration.refund_deadline)}.` : 'Xem chính sách hoàn cọc của giải.'}` : 'Hủy suất này? Các khoản đã nhận được ghi cần hoàn toàn bộ; chủ sân hoàn thủ công.'} />}
          {canHandleMoney && registration.status !== 'pending' && <div className="space-y-4 border-t border-hairline pt-4">
            <p className="text-sm text-ink-secondary">Phần lệ phí còn lại: {vnd(registration.entry_fee - registration.deposit_amount)} · {registration.balance_received_at ? 'Đã thu' : registration.balance_waived_at ? 'Đã miễn / vắng mặt' : 'Chưa thu'}</p>
            {registration.balance_receipt && <p className="break-words text-xs text-ink-secondary">Chứng từ / ghi chú: {registration.balance_receipt}</p>}
            {started && confirmed && registration.entry_fee > registration.deposit_amount && !registration.balance_received_at && !registration.balance_waived_at && <>
              <ActionForm payload={{ action: 'balance', id: registration.id, refund: false }} label={`Đã thu thêm ${vnd(registration.entry_fee - registration.deposit_amount)}`} confirmMessage="Xác nhận chủ sân đã nhận số tiền này? Không ghi lại khoản cọc SePay đã xác nhận."><Field label="Chứng từ / ghi chú thu tiền"><input className={fieldClass} name="receipt" minLength={3} maxLength={300} required /></Field></ActionForm>
              <details><summary className="min-h-11 cursor-pointer text-sm font-semibold text-pitch">Vắng mặt hoặc miễn phần còn lại</summary><ActionForm payload={{ action: 'waive_balance', id: registration.id }} label="Ghi nhận không thu thêm" confirmMessage="Xác nhận không thu phần lệ phí còn lại? Khoản cọc đã nhận giữ theo chính sách hủy."><Field label="Lý do miễn / vắng mặt"><input className={fieldClass} name="note" minLength={3} maxLength={300} required /></Field></ActionForm></details>
            </>}
            {registration.balance_refund_due > 0 && !registration.balance_refunded_at && <ActionForm payload={{ action: 'balance', id: registration.id, refund: true }} label={`Đã hoàn lệ phí còn lại ${vnd(registration.balance_refund_due)}`} confirmMessage="Chỉ xác nhận sau khi chuyển trả tiền cho người tham gia."><Field label="Chứng từ hoàn tiền"><input className={fieldClass} name="receipt" minLength={3} maxLength={300} required /></Field></ActionForm>}
          </div>}
        </div>
      </details>;
    })}</div>
    {!matching.length && <p className="border-y border-hairline py-8 text-sm text-ink-secondary">{registrations.length ? 'Không có đăng ký khớp bộ lọc.' : 'Chưa có người đăng ký tham gia.'}</p>}
  </section>;
}
