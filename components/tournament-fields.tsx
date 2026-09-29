'use client';
import { useState } from 'react';
import { SPORT_LABELS } from '@/lib/constants';
import { Field, fieldClass } from './form-field';
export function TournamentFields({ courts }: { courts: { id: string; name: string; venue: string; sport: string }[] }) {
  const [sport, setSport] = useState(Object.keys(SPORT_LABELS)[0]);
  return <>
    <section className="space-y-5"><div className="border-b border-hairline pb-4"><p className="text-xs font-bold tracking-widest text-ink-secondary">01 / THÔNG TIN GIẢI</p><h2 className="mt-2 font-display text-2xl font-bold text-pitch">Bạn muốn tổ chức giải gì?</h2></div>
      <Field label="Tên giải"><input className={fieldClass} name="title" placeholder="Ví dụ: Cầu lông cuối tuần Cầu Giấy" required minLength={3} maxLength={150} /></Field>
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Môn thi đấu"><select className={fieldClass} name="sport" value={sport} onChange={event => setSport(event.target.value)}>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field><Field label="Sân tổ chức"><select key={sport} className={fieldClass} name="court_id"><option value="">Nhờ admin bố trí sân</option>{courts.filter(c => c.sport === sport).map(c => <option key={c.id} value={c.id}>{c.venue} · {c.name}</option>)}</select></Field></div>
      <Field label="Địa chỉ / khu vực mong muốn"><input className={fieldClass} name="address" placeholder="Quận, địa chỉ sân hoặc khu vực thuận tiện" required minLength={5} maxLength={300} /></Field>
      <p className="text-xs leading-6 text-ink-secondary">Chỉ hiện sân đang hoạt động của bạn, đúng môn đã chọn. Admin xác nhận sân và địa chỉ trước khi công khai.</p>
    </section>
    <section className="space-y-5 pt-6"><div className="border-b border-hairline pb-4"><p className="text-xs font-bold tracking-widest text-ink-secondary">02 / LỊCH & QUY MÔ</p><h2 className="mt-2 font-display text-2xl font-bold text-pitch">Hẹn ngày ra sân</h2><p className="mt-2 text-sm text-ink-secondary">Tất cả thời gian là giờ Việt Nam. Hạn đăng ký không muộn hơn giờ bắt đầu.</p></div>
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Bắt đầu (giờ Việt Nam)"><input className={fieldClass} type="datetime-local" name="starts_at" required /></Field><Field label="Kết thúc (giờ Việt Nam)"><input className={fieldClass} type="datetime-local" name="ends_at" required /></Field><Field label="Hạn đăng ký và đóng cọc"><input className={fieldClass} type="datetime-local" name="registration_deadline" required /></Field><Field label="Số người / đội tối đa"><input className={fieldClass} type="number" name="capacity" min={2} max={1000} placeholder="Ví dụ: 16" required /></Field></div>
      <p className="text-xs leading-6 text-ink-secondary">Mỗi tài khoản đăng ký một suất. Ghi rõ một suất là một người hay một đội trong thể lệ.</p>
    </section>
    <section className="space-y-5 pt-6"><div className="border-b border-hairline pb-4"><p className="text-xs font-bold tracking-widest text-ink-secondary">03 / LỆ PHÍ & THỂ LỆ</p><h2 className="mt-2 font-display text-2xl font-bold text-pitch">Rõ ràng trước khi tham gia</h2></div>
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Lệ phí mỗi suất (đ)"><input className={fieldClass} type="number" name="entry_fee" min={0} max={100000000} defaultValue={0} required /></Field><Field label="Cọc mỗi suất (đ)"><input className={fieldClass} type="number" name="deposit_amount" min={0} max={100000000} defaultValue={0} required /></Field></div>
      <p className="rounded-control bg-free-fill p-4 text-sm leading-7 text-pitch">Để 0 nếu miễn phí. Cọc là một phần của lệ phí, không được vượt tổng lệ phí. Người được duyệt mới chuyển cọc; phần còn lại nộp khi tham gia.</p>
      <Field label="Thể lệ, trình độ, quy mô và thông tin liên hệ"><textarea className={fieldClass} name="description" placeholder="Giải dành cho ai? Thi đấu cá nhân hay theo đội? Thể thức, lịch có mặt, dụng cụ cần mang và cách liên hệ ban tổ chức…" required minLength={10} maxLength={5000} rows={7} /></Field>
      <p className="text-xs leading-6 text-ink-secondary">Cọc được xác nhận tự động qua SePay vào tài khoản chủ sân. Hủy trước giờ bắt đầu được hoàn cọc thủ công bởi chủ sân.</p>
    </section>
  </>;
}
