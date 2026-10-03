import { CalendarDays, Clock3, MapPin, Users } from 'lucide-react';
import type { Tournament } from '@/lib/tournaments';
import { dayLabel, hhmm, vnd } from '@/lib/format';

const dateTime = (value: string) => `${dayLabel(new Date(value))} · ${hhmm(value)}`;

export function TournamentInfo({ tournament: t, court, approved }: { tournament: Tournament; court: string | null; approved: number }) {
  return <aside className="min-w-0 space-y-4 lg:sticky lg:top-6">
    <section className="rounded-card border border-hairline bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold text-pitch">Thông tin giải</h2>
      <dl className="mt-5 space-y-5 text-sm">
        <div className="flex gap-3"><CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pitch" /><div><dt className="text-xs text-ink-secondary">Lịch thi đấu</dt><dd className="mt-1 font-semibold">{dateTime(t.starts_at)}</dd><dd className="mt-1 text-xs text-ink-secondary">Kết thúc: {dateTime(t.ends_at)}</dd></div></div>
        <div className="flex gap-3"><MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pitch" /><div className="min-w-0"><dt className="text-xs text-ink-secondary">Địa điểm</dt><dd className="mt-1 break-words font-semibold">{court ?? 'Đang chờ bố trí sân'}</dd><dd className="mt-1 break-words text-xs leading-6 text-ink-secondary">{t.address}</dd></div></div>
        <div className="flex gap-3"><Users aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pitch" /><div><dt className="text-xs text-ink-secondary">Quy mô</dt><dd className="mt-1 font-semibold">{approved} / {t.capacity} suất đã được duyệt</dd></div></div>
        <div className="flex gap-3"><Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pitch" /><div><dt className="text-xs text-ink-secondary">Nhận đăng ký đến</dt><dd className="mt-1 font-semibold">{dateTime(t.registration_deadline)}</dd></div></div>
      </dl>
      <div className="mt-6 border-t border-hairline pt-5"><div className="flex items-baseline justify-between gap-3"><span className="text-sm text-ink-secondary">Lệ phí / suất</span><strong className="font-display text-2xl text-pitch">{t.entry_fee ? vnd(t.entry_fee) : 'Miễn phí'}</strong></div><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-ink-secondary">Cọc sau khi duyệt</dt><dd className="font-semibold">{vnd(t.deposit_amount)}</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-secondary">Nộp tại giải</dt><dd className="font-semibold">{vnd(t.entry_fee-t.deposit_amount)}</dd></div></dl></div>
    </section>
    <details className="rounded-card border border-hairline bg-card px-5 sm:px-6"><summary className="cursor-pointer py-4 text-sm font-semibold text-pitch">Chính sách cọc & hủy</summary><div className="space-y-3 pb-5 text-sm leading-6 text-ink-secondary"><p>{t.cancel_window_hours === 24 ? 'Hủy trước giờ thi đấu ít nhất 24 giờ: hoàn toàn bộ cọc. Hủy muộn hơn: không hoàn cọc.' : 'Giải cũ: hủy trước giờ bắt đầu được hoàn toàn bộ cọc.'} Ban tổ chức hủy suất hoặc hủy giải: hoàn toàn bộ. Chủ sân hoàn thủ công.</p><p>Đóng cọc trong {t.payment_hold_hours} giờ sau khi được duyệt, chậm nhất {dateTime(t.payment_deadline)}. Hạn cụ thể sẽ hiện trên đăng ký của bạn.</p><p>Cọc chuyển cho chủ sân. Phần còn lại nộp tại giải; không dùng lại mã chuyển cọc.</p></div></details>
  </aside>;
}
