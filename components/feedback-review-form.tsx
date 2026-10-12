'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FEEDBACK_STATUSES, type Feedback } from '@/lib/feedback';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';

export function FeedbackReviewForm({ feedback, returnTo }: { feedback: Feedback; returnTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [stale, setStale] = useState(false);
  const { confirmDiscard, markSaved } = useUnsavedChanges(dirty, busy);
  return <form className="mt-5 border-t border-hairline pt-5" data-unsaved-changes={dirty} data-unsaved-busy={busy} onChange={() => setDirty(true)} onSubmit={async event => {
    event.preventDefault();
    if (busy || stale) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/feedback', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: feedback.id, status: fields.get('status'), reply: fields.get('reply'), updated_at: feedback.updated_at }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? 'Chưa lưu được phản hồi.'); if (response.status === 409) setStale(true); return; }
      markSaved(); setDirty(false);
      if (returnTo) router.push(returnTo);
      router.refresh();
    } catch { setError('Mất kết nối. Tải lại để kiểm tra trước khi lưu tiếp.'); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm font-semibold">Trạng thái<select name="status" defaultValue={feedback.status} className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal">{Object.entries(FEEDBACK_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block text-sm font-semibold">Phản hồi cho người gửi<textarea name="reply" defaultValue={feedback.reply} maxLength={2000} rows={4} className="mt-2 w-full rounded-control border border-hairline bg-page p-3 text-sm font-normal" /></label>
      <p className="text-xs text-ink-secondary">Phản hồi hiển thị cho người gửi. Ghi rõ kết quả khi giải quyết hoặc đóng yêu cầu.</p>
      <button disabled={stale} className="min-h-11 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang lưu…' : returnTo ? 'Lưu và về danh sách' : 'Lưu phản hồi'}</button>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {stale && <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-pitch underline" onClick={() => {
      if (!confirmDiscard()) return;
      markSaved(); setDirty(false); router.refresh();
    }}>Tải bản mới để tiếp tục</button>}
  </form>;
}
