import { SPORT_LABELS } from '@/lib/constants';
export const fieldClass = 'min-h-11 w-full rounded-control border border-hairline bg-page px-3 py-2 text-sm font-normal';
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2 text-sm font-semibold">{label}{children}</label>;
}
export function TournamentFields({ courts }: { courts: { id: string; name: string; venue: string }[] }) {
  return <>
    <Field label="Tên giải"><input className={fieldClass} name="title" required minLength={3} maxLength={150} /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Môn thi đấu"><select className={fieldClass} name="sport">{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Sân tổ chức"><select className={fieldClass} name="court_id"><option value="">Nhờ admin bố trí sân</option>{courts.map(c => <option key={c.id} value={c.id}>{c.venue} · {c.name}</option>)}</select></Field>
    </div>
    <Field label="Địa chỉ / khu vực mong muốn"><input className={fieldClass} name="address" required minLength={5} maxLength={300} /></Field>
    <p className="text-xs leading-6 text-ink-secondary">Admin xác nhận sân và địa chỉ trước khi công khai. Quy mô tính theo người hoặc đội: ghi rõ trong thể lệ; mỗi tài khoản đăng ký một suất.</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Bắt đầu (giờ Việt Nam)"><input className={fieldClass} type="datetime-local" name="starts_at" required /></Field>
      <Field label="Kết thúc (giờ Việt Nam)"><input className={fieldClass} type="datetime-local" name="ends_at" required /></Field>
      <Field label="Hạn đăng ký và đóng cọc"><input className={fieldClass} type="datetime-local" name="registration_deadline" required /></Field>
      <Field label="Số người / đội tối đa"><input className={fieldClass} type="number" name="capacity" min={2} max={1000} required /></Field>
      <Field label="Lệ phí mỗi suất (đ)"><input className={fieldClass} type="number" name="entry_fee" min={0} max={100000000} defaultValue={0} required /></Field>
      <Field label="Cọc mỗi suất (đ)"><input className={fieldClass} type="number" name="deposit_amount" min={0} max={100000000} defaultValue={0} required /></Field>
    </div>
    <Field label="Thể lệ, trình độ, quy mô và thông tin liên hệ"><textarea className={fieldClass} name="description" required minLength={10} maxLength={5000} rows={6} /></Field>
    <p className="text-sm leading-6 text-ink-secondary">Cọc không vượt lệ phí. Người được duyệt chuyển cọc qua SePay tới chủ sân; phần lệ phí còn lại nộp khi tham gia. Hủy trước giờ bắt đầu được hoàn cọc thủ công bởi chủ sân.</p>
  </>;
}
