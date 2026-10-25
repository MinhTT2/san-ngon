'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
export function DataRequestForm() {
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [sent, setSent] = useState<string | null>(null);
  return <form className="space-y-4 rounded-card border border-hairline bg-card p-5" onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const payload = { action: fields.get('action'), message: fields.get('message') }; const serialized = JSON.stringify(payload);
    if (request.current?.payload !== serialized) request.current = { payload: serialized, id: crypto.randomUUID() };
    setBusy(true); setError(''); setSent(null);
    try {
      const response = await fetch('/api/privacy/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: request.current.id }) });
      const data = await response.json(); if (!response.ok) { setError(data.error || 'Chưa gửi được yêu cầu.'); return; }
      setSent(data.id); request.current = null; form.reset();
    } catch { setError('Kết nối gián đoạn. Thử lại cùng nội dung sẽ giữ nguyên mã yêu cầu.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-display text-xl font-bold text-pitch">Gửi yêu cầu dữ liệu</h2>
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <div><label htmlFor="data-request-action" className="block text-sm font-semibold">Bạn muốn làm gì?</label><select id="data-request-action" name="action" className="mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 font-normal"><option value="access">Xem hoặc nhận thêm dữ liệu</option><option value="correct">Sửa dữ liệu</option><option value="delete">Xóa dữ liệu</option></select></div>
      <div><label htmlFor="data-request-message" className="block text-sm font-semibold">Phạm vi cần xử lý</label><textarea id="data-request-message" name="message" minLength={20} maxLength={3000} required rows={5} className="mt-2 w-full rounded-control border border-hairline bg-page p-3 font-normal" aria-describedby="data-request-hint" /></div>
      <p id="data-request-hint" className="text-xs leading-6 text-ink-secondary">Mô tả 20–3.000 ký tự, nêu loại dữ liệu và mã đơn nếu có. Không gửi mật khẩu, OTP hoặc thêm giấy tờ nhạy cảm. Dữ liệu cần đối soát/hoàn tiền/tranh chấp có thể phải giữ; admin sẽ trả lời phạm vi xử lý.</p>
      <button className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">{busy ? 'Đang gửi…' : 'Gửi yêu cầu dữ liệu'}</button>
    </fieldset>
    {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}
    {sent && <p role="status" className="text-sm text-pitch">Đã tiếp nhận. <Link href={`/gop-y#gop-y-${sent}`} className="underline">Theo dõi và đọc phản hồi</Link></p>}
  </form>;
}
