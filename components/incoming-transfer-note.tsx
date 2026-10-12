'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
export function IncomingTransferNote({ id, updatedAt }: { id: string; updatedAt: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const attempt = useRef<{ id: string; note: string; updated_at: string } | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || note.trim().length < 10) return;
    if (!attempt.current || attempt.current.note !== note.trim() || attempt.current.updated_at !== updatedAt) attempt.current = { id: crypto.randomUUID(), note: note.trim(), updated_at: updatedAt };
    setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch(`/api/incoming-transfers/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_id: attempt.current.id, note: attempt.current.note, updated_at: attempt.current.updated_at }) });
      const data = await response.json(); if (!response.ok) { setError(data.error || 'Chưa lưu được ghi chú.'); return; }
      setNote(''); attempt.current = null; setSaved(true); router.refresh();
    } catch { setError('Mất kết nối. Ghi chú vẫn được giữ, bạn có thể gửi lại.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} data-unsaved-changes={note.trim().length > 0 ? 'true' : undefined} data-unsaved-busy={busy ? 'true' : undefined} className="mt-4 border-t border-hairline pt-4">
    <label className="block text-sm font-semibold" htmlFor={`note-${id}`}>Ghi chú đối soát</label><textarea id={`note-${id}`} rows={2} minLength={10} maxLength={1000} value={note} disabled={!ready || busy} onChange={event => { setNote(event.target.value); setSaved(false); }} className="mt-2 w-full rounded-control border border-hairline bg-page p-3 font-normal" placeholder="Thông tin đã kiểm tra, bước xử lý tiếp theo…" />
    <p className="mt-1 text-xs leading-5 text-ink-secondary">Ghi chú không xác nhận hoàn tiền và không xóa khoản cần đối soát. Tránh ghi số giấy tờ hoặc dữ liệu nhạy cảm.</p>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}{saved && <p role="status" className="mt-2 text-sm text-success">Đã lưu ghi chú.</p>}
    <button disabled={!ready || busy || note.trim().length < 10} className="mt-3 min-h-11 rounded-control border border-pitch px-4 text-sm font-semibold text-pitch disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu ghi chú'}</button>
  </form>;
}
