import Image from 'next/image';
import { Check, Circle, CreditCard } from 'lucide-react';
import { registrationLabel, type Registration, type Tournament } from '@/lib/tournaments';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { vietQrUrl } from '@/lib/sepay';
import { CopyValue } from './copy-value';
import { ActionForm } from './action-form';

const dateTime = (value: string) => `${dayLabel(new Date(value))} · ${hhmm(value)}`;
export function TournamentRegistration({ registration, tournament, canRegisterAgain, now, paymentHref = '#giao-dich' }: {
  registration: Registration; tournament: Tournament; canRegisterAgain: boolean; now: number; paymentHref?: string;
}) {
  const payClosed = !registration.payment_expires_at || Date.parse(registration.payment_expires_at) <= now || tournament.status !== 'published';
  const confirmed = registration.status === 'approved' && (registration.paid_at || registration.deposit_amount === 0);
  const awaitingPayment = registration.status === 'approved' && !confirmed && !payClosed;
  const terminal = ['cancelled', 'expired', 'rejected'].includes(registration.status) || tournament.status === 'cancelled';
  const label = tournament.status === 'cancelled' ? 'Giải đã hủy' : registrationLabel(registration);
  const message = tournament.status === 'cancelled' ? 'Không chuyển thêm tiền. Các khoản đã nhận được đối soát và hoàn thủ công; xem giao dịch bên dưới.'
    : registration.status === 'pending' ? 'Ban tổ chức đang xem đăng ký. Bạn chưa cần chuyển cọc.'
    : confirmed ? tournament.status === 'completed' || Date.parse(tournament.ends_at) <= now ? 'Giải đã kết thúc. Xem lại các khoản thu và hoàn trong mục giao dịch.' : 'Suất tham gia đã được xác nhận. Kiểm tra lịch, địa điểm và thể lệ trước ngày thi đấu.'
    : awaitingPayment ? 'Chuyển đủ cọc trong một giao dịch trước hạn bên dưới để xác nhận suất tham gia.'
    : registration.status === 'approved' || registration.status === 'expired' ? 'Đăng ký đã hết hạn, không chuyển vào mã cọc cũ. Gửi đăng ký mới nếu giải còn nhận người.'
    : registration.status === 'rejected' ? 'Đăng ký chưa được chấp nhận. Xem lý do của ban tổ chức; bạn có thể gửi lại nếu giải còn nhận người.'
    : 'Đăng ký đã hủy. Các khoản cần hoàn được theo dõi trong mục giao dịch; chủ sân hoàn qua ngân hàng.';
  return <section id="dang-ky" aria-label="Đăng ký của bạn" className="scroll-mt-28 border-y border-hairline py-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-display text-xl font-bold text-pitch">Đăng ký của bạn</h2><p className="mt-2 break-words text-sm text-ink-secondary">{registration.full_name}{registration.team_name && ` · ${registration.team_name}`}</p></div>
      <p className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${registration.status === 'pending' || awaitingPayment ? 'border-peak-line bg-peak-fill text-peak-ink' : 'border-hairline bg-sunk text-pitch'}`}>{label}</p>
    </div>
    {!terminal && <ol aria-label="Tiến trình đăng ký" className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">{[
      ['Đã gửi đăng ký', true], ['Ban tổ chức duyệt', registration.status === 'approved'], [registration.deposit_amount ? 'Xác nhận cọc' : 'Xác nhận tham gia', !!confirmed],
    ].map(([title, done], index) => <li key={String(title)} aria-current={!done && (index === 1 || registration.status === 'approved') ? 'step' : undefined} className={`flex min-h-10 items-center gap-2 border-b-2 pb-2 ${done ? 'border-strong text-pitch' : 'border-hairline text-ink-secondary'}`}>
      {done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}<span>{title}</span>
    </li>)}</ol>}
    <p role="status" className="mt-4 text-sm leading-7">{message}</p>
    {registration.review_note && <p className="mt-3 whitespace-pre-wrap break-words border-l-2 border-strong pl-4 text-sm leading-7">Ghi chú ban tổ chức: {registration.review_note}</p>}
    {awaitingPayment && registration.bank && registration.account_number && <div className="mt-5 grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
      <Image unoptimized width={220} height={270} className="w-[200px] max-w-full rounded-control border border-hairline" src={vietQrUrl(registration.code, registration.deposit_amount, registration.bank, registration.account_number)} alt={`QR chuyển cọc ${vnd(registration.deposit_amount)}, nội dung ${registration.code}`} />
      <div className="min-w-0 space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-pitch"><CreditCard size={18} aria-hidden="true" />Đóng cọc {vnd(registration.deposit_amount)}</p>
        <p>Ngân hàng: <strong>{registration.bank}</strong></p>
        <p className="break-words">Người nhận: <strong>{registration.account_name}</strong></p>
        <div>Số tài khoản: <CopyValue label="số tài khoản" value={registration.account_number} /></div>
        <div>Nội dung: <CopyValue label="nội dung chuyển khoản" value={registration.code} /></div>
        <p className="font-semibold text-peak-ink">Hạn cọc: {dateTime(registration.payment_expires_at!)}</p>
        <p className="text-xs leading-6 text-ink-secondary">Trang tự cập nhật khi nhận đủ cọc. Nếu đã chuyển tiền, không chuyển lại khi chưa thấy xác nhận. Chuyển thiếu không được cộng dồn; chuyển thừa, trùng hoặc muộn được ghi để hoàn và đối soát.</p>
      </div>
    </div>}
    {confirmed && registration.entry_fee > registration.deposit_amount && <p className="mt-3 text-sm leading-7">{registration.balance_received_at ? 'Đã thu phần còn lại' : registration.balance_waived_at ? 'Đã miễn / không thu phần còn lại' : 'Nộp khi tham gia'}: <strong>{vnd(registration.entry_fee - registration.deposit_amount)}</strong>{!registration.balance_received_at && !registration.balance_waived_at && '. Dùng tiền mặt hoặc nội dung riêng, không dùng lại mã cọc GIAI.'}</p>}
    {registration.balance_refund_due > 0 && <p className="mt-3 text-sm">{registration.balance_refunded_at ? 'Đã hoàn' : 'Cần hoàn'} phần lệ phí còn lại: {vnd(registration.balance_refund_due)}</p>}
    {registration.refund_deadline && ['pending', 'approved'].includes(registration.status) && tournament.status === 'published' && <p className="mt-3 text-xs leading-6 text-ink-secondary">Mốc tự hủy được hoàn cọc: {dateTime(registration.refund_deadline)}. Hủy sau mốc này không được hoàn cọc; ban tổ chức hủy luôn hoàn toàn bộ.</p>}
    <div className="mt-4 flex flex-wrap items-start gap-4">
      {canRegisterAgain && <a href="#dang-ky-lai" className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Gửi đăng ký mới</a>}
      {!!registration.paid_at && <a href={paymentHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Xem giao dịch</a>}
      {Date.parse(tournament.starts_at) > now && tournament.status === 'published' && ['pending', 'approved'].includes(registration.status) && <ActionForm payload={{ action: 'cancel_registration', id: registration.id }} variant="danger" label="Hủy tham gia" confirmMessage={`Hủy đăng ký? ${registration.refund_deadline ? `Chỉ hoàn cọc nếu bạn hủy không muộn hơn ${dateTime(registration.refund_deadline)}. Sau mốc này không hoàn cọc.` : 'Xem chính sách hoàn cọc của giải.'}`} />}
    </div>
  </section>;
}
