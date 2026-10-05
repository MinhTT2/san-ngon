'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FEEDBACK_STATUSES, type Feedback } from '@/lib/feedback';

export function FeedbackReviewForm({ feedback }: { feedback: Feedback }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="mt-5 border-t border-hairline pt-5" onSubmit={async event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/feedback', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: feedback.id, status: fields.get('status'), reply: fields.get('reply'), updated_at: feedback.updated_at }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? 'Chưa lưu được phản hồi.'); if (response.status === 409) router.refresh(); return; }
      router.refresh();
    } catch { setError('Mất kết nối. Tải lại để kiểm tra trước khi lưu tiếp.'); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm font-semibold">Trạng thái<select name="status" defaultValue={feedback.status} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal">{Object.entries(FEEDBACK_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block text-sm font-semibold">Phản hồi cho người gửi<textarea name="reply" defaultValue={feedback.reply} maxLength={2000} rows={4} className="mt-2 w-full rounded-control border border-hairline bg-page p-3 text-sm font-normal" /></label>
      <p className="text-xs text-ink-secondary">Phản hồi hiển thị cho người gửi. Ghi rõ kết quả khi giải quyết hoặc đóng yêu cầu.</p>
      <button className="min-h-11 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">{busy ? 'Đang lưu…' : 'Lưu phản hồi'}</button>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </form>;
}
