'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/modal';

export function AdminOwnerAction({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  async function review(status: 'active' | 'rejected') {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/owners/${ownerId}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, reason: status === 'rejected' ? reason.trim() : undefined }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setError(result.error ?? 'Không lưu được. Hãy thử lại.');
      else { setRejecting(false); router.refresh(); }
    } catch { setError('Chưa nhận được kết quả. Tải lại hồ sơ để kiểm tra trước khi xử lý tiếp.'); }
    finally { sending.current = false; setBusy(false); }
  }
  function close() { if (!sending.current) { setRejecting(false); setError(null); } }
  function reject(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void review('rejected'); }
  return <>
    <span className="inline-flex flex-col items-end gap-2"><span className="flex flex-wrap gap-2"><button type="button" onClick={() => review('active')} disabled={busy} className="pf-action min-h-11 rounded-control bg-pitch px-3 text-xs font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang lưu…' : 'Duyệt chủ sân'}</button><button type="button" aria-haspopup="dialog" onClick={() => { setError(null); setRejecting(true); }} disabled={busy} className="pf-action min-h-11 rounded-control border border-hairline px-3 text-xs font-semibold text-danger disabled:opacity-60">Từ chối</button></span>{error && !rejecting && <span role="alert" className="max-w-xs text-xs text-danger">{error}</span>}</span>
    {rejecting && <Modal title="Yêu cầu bổ sung hồ sơ" size="max-w-lg" onClose={close}>
      <form onSubmit={reject} aria-busy={busy} data-unsaved-busy={busy} className="space-y-4">
        <p className="text-sm leading-6 text-ink-secondary">Ghi rõ thông tin hoặc giấy tờ cần sửa. Chủ sân sẽ nhận được lý do này trong hồ sơ và thông báo.</p>
        <label className="block text-sm font-semibold">Lý do cần bổ sung<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="mt-2 min-h-32 w-full rounded-control border border-hairline bg-page p-3 font-normal" /></label>
        <p className="text-xs text-ink-secondary">10–1.000 ký tự. Không ghi mã truy cập hoặc thông tin riêng của người khác.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={close} className="pf-action min-h-11 rounded-control border border-hairline px-4">Quay lại</button><button type="submit" disabled={busy || reason.trim().length < 10} className="pf-action min-h-11 rounded-control bg-pitch px-4 font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang lưu…' : 'Gửi yêu cầu bổ sung'}</button></div>
      </form>
    </Modal>}
  </>;
}
