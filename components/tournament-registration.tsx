import Link from 'next/link';
import { Check } from 'lucide-react';
import type { Registration, Tournament } from '@/lib/tournaments';
import { registrationStatuses } from '@/lib/tournaments';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { vietQrUrl } from '@/lib/sepay';
import { ActionForm } from './action-form';
import { Field, fieldClass } from './form-field';
import { TournamentPaymentQr } from './tournament-payment-qr';
import { CopyValue } from './copy-value';

const dateTime = (value: string) => `${dayLabel(new Date(value))} · ${hhmm(value)}`;

export function TournamentRegistrationForm({ tournament: t, signedIn, profile, again = false }: {
  tournament: Tournament; signedIn: boolean; profile: { full_name: string | null; phone: string | null } | null; again?: boolean;
}) {
  return <section id={again ? 'dang-ky-lai' : 'dang-ky'} className="scroll-mt-6 rounded-card border border-strong bg-card p-5 sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Bước 1 / Gửi thông tin</p>
    <h2 className="mt-2 font-display text-2xl font-bold text-pitch">Đăng ký tham gia</h2>
    <p className="mb-6 mt-2 text-sm leading-6 text-ink-secondary">Ban tổ chức sẽ duyệt đăng ký của bạn. Chưa cần chuyển tiền ở bước này.</p>
    {signedIn ? <ActionForm payload={{ action: 'register', id: t.id }} nested label="Gửi đăng ký" successMessage="Đã gửi đăng ký. Ban tổ chức sẽ xem và duyệt.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên người tham gia / đại diện"><input className={fieldClass} name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? ''} minLength={2} maxLength={100} required /></Field>
        <Field label="Số điện thoại"><input className={fieldClass} name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone ?? ''} maxLength={25} required /></Field>
        <Field label="Địa chỉ / khu vực"><input className={fieldClass} name="address" placeholder="Ví dụ: Cầu Giấy, Hà Nội" minLength={2} maxLength={300} required /></Field>
        <Field label="Tên đội (nếu thi đấu theo đội)"><input className={fieldClass} name="team_name" maxLength={100} /></Field>
      </div>
      <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink-secondary">Thêm ghi chú cho ban tổ chức (tùy chọn)</summary><Field label="Trình độ, thành viên và ghi chú"><textarea className={fieldClass} name="note" maxLength={1000} rows={3} /></Field></details>
      <p className="rounded-control bg-free-fill p-4 text-sm leading-6 text-pitch">{t.deposit_amount ? <>Sau khi được duyệt, bạn đóng cọc <strong>{vnd(t.deposit_amount)}</strong> cho chủ sân. Tổng lệ phí: {vnd(t.entry_fee)} / suất.</> : 'Giải này không yêu cầu cọc. Đăng ký hoàn tất khi ban tổ chức duyệt.'}</p>
    </ActionForm> : <Link href={`/dang-nhap?next=/giai-dau/${t.id}`} className="inline-flex min-h-12 items-center justify-center rounded-control bg-pitch px-6 text-sm font-semibold text-pitch-ink">Đăng nhập để tham gia</Link>}
  </section>;
}

export function TournamentRegistration({ own, nextStep, payClosed, started, canJoin }: {
  own: Registration; nextStep: string; payClosed: boolean; started: boolean; canJoin: boolean;
}) {
  const waitingPayment = own.status === 'approved' && !own.paid_at && own.deposit_amount > 0 && !payClosed;
  const complete = own.status === 'approved' && (!!own.paid_at || own.deposit_amount === 0);
  return <section id="dang-ky" className="scroll-mt-6 overflow-hidden rounded-card border border-strong bg-card">
    <div className={`border-b border-hairline p-5 sm:p-6 ${waitingPayment || own.status === 'pending' ? 'bg-peak-fill' : 'bg-free-fill'}`}>
      <p className="text-xs font-semibold text-ink-secondary">Đăng ký của bạn</p>
      <h2 className="mt-2 font-display text-2xl font-bold text-pitch">{waitingPayment ? 'Đóng cọc để giữ suất' : complete ? 'Bạn đã có suất tham gia' : own.status === 'pending' ? 'Đang chờ ban tổ chức duyệt' : registrationStatuses[own.status]}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">{nextStep}</p>
    </div>
    <div className="p-5 sm:p-6">
      {['pending','approved'].includes(own.status) && <ol aria-label="Tiến trình đăng ký" className="mb-6 grid grid-cols-3 gap-2 text-xs sm:gap-4">{['Gửi đăng ký','Được duyệt',own.deposit_amount ? 'Đóng cọc' : 'Hoàn tất'].map((label, i) => {
        const done = i === 0 || (i === 1 && own.status === 'approved') || (i === 2 && complete);
        return <li key={label} className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className={`grid size-7 shrink-0 place-items-center rounded-full border ${done ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline text-ink-secondary'}`}>{done ? <Check className="size-4" aria-hidden="true" /> : i + 1}</span><span className={done ? 'font-semibold text-pitch' : 'text-ink-secondary'}>{label}<span className="sr-only">{done ? ': đã xong' : ': chưa xong'}</span></span></li>;
      })}</ol>}
      {waitingPayment && own.bank && own.account_number && <>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-ink-secondary">Số tiền cần chuyển</p><p className="mt-1 font-display text-4xl font-bold text-pitch">{vnd(own.deposit_amount)}</p></div><div className="rounded-control bg-peak-fill px-4 py-3 text-sm text-peak-ink"><p className="text-xs">Chuyển trước</p><strong>{dateTime(own.payment_expires_at!)}</strong></div></div>
        <div className="grid items-start gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
          <TournamentPaymentQr src={vietQrUrl(own.code,own.deposit_amount,own.bank,own.account_number)} alt={`QR chuyển cọc ${vnd(own.deposit_amount)}, nội dung ${own.code}`} />
          <dl className="min-w-0 space-y-3 text-sm"><div><dt className="text-xs text-ink-secondary">Ngân hàng</dt><dd className="mt-1 font-semibold">{own.bank}</dd></div><div><dt className="text-xs text-ink-secondary">Số tài khoản</dt><dd><CopyValue label="số tài khoản" value={own.account_number} /></dd></div><div><dt className="text-xs text-ink-secondary">Người nhận · tài khoản chủ sân</dt><dd className="mt-1 break-words font-semibold">{own.account_name}</dd></div><div className="rounded-control border border-strong bg-free-fill p-3"><dt className="text-xs text-ink-secondary">Nội dung chuyển khoản</dt><dd><CopyValue label="nội dung chuyển khoản" value={own.code} /></dd></div></dl>
        </div>
        <p role="status" className="mt-5 text-sm font-semibold text-peak-ink">Chờ chuyển khoản. Trang tự cập nhật khi nhận đủ cọc.</p>
        <p className="mt-2 text-xs leading-6 text-ink-secondary">Chuyển đủ tiền trong một giao dịch, giữ nguyên nội dung. Nếu đã chuyển thiếu hoặc trùng, liên hệ chủ sân để đối soát; không chuyển thêm vào mã này.</p>
      </>}
      {complete && <div className="rounded-control border border-hairline p-4 text-sm"><p className="font-semibold text-pitch">{own.deposit_amount ? `Đã nhận cọc ${vnd(own.deposit_amount)}` : 'Không yêu cầu cọc'}</p><p className="mt-2 text-ink-secondary">{own.balance_received_at ? `Đã nhận phần lệ phí còn lại: ${vnd(own.entry_fee-own.deposit_amount)}` : own.balance_waived_at ? 'Đã miễn phần lệ phí còn lại.' : own.entry_fee > own.deposit_amount ? `Còn ${vnd(own.entry_fee-own.deposit_amount)} nộp tại giải. Không dùng lại mã chuyển cọc.` : 'Bạn đã hoàn tất lệ phí.'}</p></div>}
      {own.balance_refund_due > 0 && <p className="mt-3 text-sm">{own.balance_refunded_at ? 'Đã hoàn' : 'Cần hoàn'} phần lệ phí còn lại: {vnd(own.balance_refund_due)}</p>}
      {own.review_note && <p className="mt-3 rounded-control bg-sunk p-4 text-sm leading-6">Ghi chú từ ban tổ chức: {own.review_note}</p>}
      {canJoin && <a href="#dang-ky-lai" className="mt-4 inline-flex min-h-11 items-center rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Gửi đăng ký mới</a>}
      {!started && ['pending','approved'].includes(own.status) && <details className="mt-5 border-t border-hairline pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-secondary">Tôi không tham gia được / hủy đăng ký</summary><p className="mb-3 text-xs leading-6 text-ink-secondary">{own.refund_deadline ? `Hủy không muộn hơn ${dateTime(own.refund_deadline)} để được hoàn cọc. Sau mốc này không hoàn cọc.` : 'Bạn có thể hủy đăng ký trước giờ giải bắt đầu.'}</p><ActionForm payload={{ action: 'cancel_registration', id: own.id }} variant="danger" label="Hủy tham gia" confirmMessage={`Hủy đăng ký? ${own.refund_deadline ? `Chỉ hoàn cọc nếu hủy không muộn hơn ${dateTime(own.refund_deadline)}.` : 'Xem chính sách hoàn cọc của giải.'}`} /></details>}
    </div>
  </section>;
}
