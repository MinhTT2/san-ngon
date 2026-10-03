import { ActionForm } from './action-form';
import { Field, fieldClass } from './form-field';

export function TournamentReviewRegistration({ id }: { id: string }) {
  return <div className="mt-4 space-y-3">
    <ActionForm payload={{ action: 'review_registration', id, approve: true }} label="Duyệt tham gia" successMessage="Đã duyệt. Người tham gia sẽ nhận hướng dẫn bước tiếp theo.">
      <details><summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-secondary">Thêm lời nhắn (tùy chọn)</summary><Field label="Ghi chú khi duyệt"><input className={fieldClass} name="note" maxLength={1000} /></Field></details>
    </ActionForm>
    <details><summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-secondary">Không phù hợp? Từ chối đăng ký</summary><ActionForm payload={{ action: 'review_registration', id, approve: false }} variant="danger" label="Từ chối đăng ký"><Field label="Lý do từ chối"><input className={fieldClass} name="note" minLength={3} maxLength={1000} required /></Field></ActionForm></details>
  </div>;
}
