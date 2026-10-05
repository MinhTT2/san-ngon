'use client';
import { useState } from 'react';
import { ActionForm } from './action-form';
import { Field, fieldClass } from './form-field';

export function TournamentReviewForm({ id, courtId, courts }: {
  id: string; courtId: string | null; courts: { id: string; name: string; venues: { name: string } }[];
}) {
  const [approve, setApprove] = useState(true);
  const [venueFee, setVenueFee] = useState(0);
  return <ActionForm payload={{ action: 'review', id, ...(!approve ? { court_id: '', venue_fee: 0, cancellation_venue_fee: 0, terms_note: '', terms_confirmed: false } : {}) }}
    label={approve ? 'Công khai giải và khóa lịch sân' : 'Từ chối đề xuất'} variant={approve ? 'primary' : 'danger'}
    confirmMessage={approve ? 'Hai bên đã thống nhất thỏa thuận? Công khai sẽ khóa lịch sân và cố định lịch, lệ phí, thể lệ của giải.' : 'Từ chối đề xuất và gửi lý do cho người tổ chức?'}>
    <Field label="Kết quả duyệt"><select className={fieldClass} name="approve" value={String(approve)} onChange={event => setApprove(event.target.value === 'true')}><option value="true">Duyệt và công khai</option><option value="false">Không duyệt</option></select></Field>
    {approve && <>
      <Field label="Sân tổ chức"><select className={fieldClass} name="court_id" defaultValue={courtId ?? ''} required><option value="">Chọn sân để duyệt</option>{courts.map(court => <option key={court.id} value={court.id}>{court.venues.name} · {court.name}</option>)}</select></Field>
      {!courts.length && <p role="status" className="text-sm text-danger">Chưa có sân đang hoạt động đúng môn thi đấu. Chưa thể công khai giải.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tiền thuê sân đã thỏa thuận (đ)"><input className={fieldClass} type="number" name="venue_fee" min={0} max={100000000} value={venueFee} onChange={event => setVenueFee(Number(event.target.value))} required /></Field>
        <Field label="Tiền thuê khi người tổ chức hủy (đ)"><input className={fieldClass} type="number" name="cancellation_venue_fee" min={0} max={venueFee} defaultValue={0} required /></Field>
      </div>
      <Field label="Thỏa thuận thu phí và thuê sân"><textarea className={fieldClass} name="terms_note" minLength={10} maxLength={1000} rows={4} required placeholder="Tiền thuê, cách thu/hoàn tiền, người chịu phần thiếu và quyết toán trong 7 ngày sau giải." /></Field>
      <label className="flex items-start gap-3 border-l-2 border-strong pl-4 text-sm leading-7"><input className="mt-1.5 size-5 shrink-0 accent-pitch" type="checkbox" name="terms_confirmed" required />Chủ sân và người tổ chức đã đồng ý thỏa thuận, cách thu/hoàn và quyết toán.</label>
    </>}
    <Field label={approve ? 'Ghi chú cho người tổ chức (không bắt buộc)' : 'Lý do không duyệt'}><textarea className={fieldClass} name="note" minLength={approve ? undefined : 3} maxLength={1000} rows={3} required={!approve} /></Field>
  </ActionForm>;
}
