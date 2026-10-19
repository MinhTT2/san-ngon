'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { isRegistrationConfirmed, registrationLabel } from '@/lib/tournament-status';
import type { Registration } from '@/lib/tournaments';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { ActionForm } from './action-form';
import { Field, fieldClass } from './form-field';
import { TournamentReviewRegistration } from './tournament-review-registration';

const FILTERS = [
  ['confirmed', 'Đã xác nhận tham gia'], ['pending', 'Chờ duyệt'], ['unpaid', 'Chờ đóng cọc'],
  ['expired', 'Hết hạn'], ['rejected', 'Không được duyệt'], ['cancelled', 'Đã hủy'], ['all', 'Tất cả đăng ký & lịch sử'],
] as const;
type Category = typeof FILTERS[number][0];
const categoryOf = (registration: Registration): string => registration.status === 'approved'
  ? isRegistrationConfirmed(registration) ? 'confirmed' : 'unpaid' : registration.status;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');

export function TournamentParticipants({ registrations, closed, started, canCancel, userId, admin }: {
  registrations: Registration[]; closed: boolean; started: boolean; canCancel: boolean; userId: string; admin: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category>('confirmed');
  const counts = Object.fromEntries(FILTERS.map(([value]) => [value, value === 'all' ? registrations.length : registrations.filter(registration => categoryOf(registration) === value).length])) as Record<Category, number>;
  const filtered = search.trim().length > 0;
  function chooseFilter(value: Category) { setFilter(value); }
  const matching = registrations.filter(registration => {
    const category = categoryOf(registration);
    return (filter === 'all' || category === filter) && normalize(`${registration.full_name} ${registration.team_name ?? ''} ${registration.phone}`).includes(normalize(search.trim()));
  });
  return <section id="nguoi-tham-gia" className="scroll-mt-28 py-6">
    <h2 className="font-display text-2xl font-bold text-pitch">{filter === 'confirmed' ? 'Người tham gia đã xác nhận' : 'Quản lý đăng ký'}</h2>
    <p className="mt-3 text-sm leading-7 text-ink-secondary">Danh sách tham gia chỉ gồm suất đã nhận đủ cọc hoặc được duyệt không yêu cầu cọc. Chọn trạng thái khác để duyệt đăng ký, theo dõi cọc hoặc xem lịch sử.</p>
    <nav aria-label="Xử lý đăng ký" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {FILTERS.slice(0, 3).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => chooseFilter(value)} className={`pf-action flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-control border px-4 py-3 text-left text-sm font-semibold ${filter === value ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card text-pitch hover:bg-free-fill'}`}><span>{label}</span><span className="tabular-nums">{counts[value]}</span></button>)}
    </nav>
    <div className="my-5 grid items-end gap-4 sm:grid-cols-[1fr_240px]">
      <Field label="Tìm người hoặc đội"><span className="relative"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-ink-secondary" /><input className={`${fieldClass} pl-10`} type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Họ tên, tên đội, số điện thoại" /></span></Field>
      <Field label="Trạng thái đăng ký"><select className={fieldClass} value={filter} onChange={event => chooseFilter(event.target.value as Category)}>{FILTERS.map(([value, label]) => <option key={value} value={value}>{label} ({counts[value]})</option>)}</select></Field>
    </div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-xs leading-6 text-ink-secondary">{matching.length} / {counts[filter]} {filter === 'confirmed' ? 'suất đã xác nhận' : 'đăng ký trong trạng thái đã chọn'}</p>
      {filtered && <button type="button" onClick={() => setSearch('')} className="pf-action min-h-11 px-2 text-xs font-semibold text-pitch underline underline-offset-4">Xóa tìm kiếm</button>}
    </div>
    <div className="space-y-3">{matching.map(registration => {
      const confirmed = isRegistrationConfirmed(registration);
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
    {!matching.length && <div className="rounded-card border border-hairline bg-page p-5 sm:p-7">
      <p className="font-semibold text-pitch">{filtered ? 'Không có đăng ký khớp tìm kiếm.' : filter === 'confirmed' ? 'Chưa có suất nào được xác nhận tham gia.' : counts.all ? 'Chưa có đăng ký trong trạng thái này.' : 'Chưa có người đăng ký tham gia.'}</p>
      <p className="mt-2 text-sm leading-7 text-ink-secondary">{filtered ? 'Thử tên ngắn hơn, tên đội hoặc số điện thoại; xóa tìm kiếm để xem lại trạng thái đang chọn.' : counts.pending ? `Còn ${counts.pending} đăng ký chờ duyệt. Duyệt đăng ký để người chơi tiếp tục bước đóng cọc.` : counts.unpaid ? `Có ${counts.unpaid} đăng ký đang chờ đóng cọc. Suất sẽ được xác nhận khi nhận đủ cọc.` : 'Đăng ký mới và các thay đổi trạng thái sẽ xuất hiện tại đây.'}</p>
      {filtered ? <button type="button" onClick={() => setSearch('')} className="pf-action mt-3 min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Xóa tìm kiếm</button>
        : (counts.pending > 0 || counts.unpaid > 0) && <button type="button" onClick={() => chooseFilter(counts.pending ? 'pending' : 'unpaid')} className="pf-action mt-3 min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">{counts.pending ? 'Xem đăng ký chờ duyệt' : 'Xem đăng ký chờ đóng cọc'}</button>}
    </div>}
  </section>;
}
