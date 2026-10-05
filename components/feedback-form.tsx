'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FEEDBACK_CATEGORIES } from '@/lib/feedback';

export function FeedbackForm({ pagePath }: { pagePath: string | null }) {
  const router = useRouter();
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  return <form className="rounded-card border border-hairline bg-card p-5 sm:p-7" onSubmit={async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const payload = { category: fields.get('category'), title: fields.get('title'), message: fields.get('message'), page_path: pagePath };
    const serialized = JSON.stringify(payload);
    if (request.current?.payload !== serialized) request.current = { payload: serialized, id: crypto.randomUUID() };
    setBusy(true); setError(''); setSentId(null);
    try {
      const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: request.current.id }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? 'Chưa gửi được góp ý.'); return; }
      form.reset(); setTitle(''); setMessage(''); request.current = null; setSentId(result.id); router.refresh();
    } catch { setError('Kết nối bị gián đoạn. Bạn có thể thử lại cùng nội dung; hệ thống không tạo yêu cầu trùng.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-display text-xl font-bold text-pitch">Gửi góp ý mới</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">Chỉ bạn và quản trị đọc được nội dung. Không gửi mật khẩu, mã OTP hoặc thông tin tài khoản ngân hàng.</p>
    {pagePath && <p className="mt-3 break-all text-xs text-ink-secondary">Trang liên quan: {pagePath}</p>}
    <fieldset disabled={busy} className="mt-5 space-y-4 disabled:opacity-60">
      <div><label htmlFor="feedback-category" className="block text-sm font-semibold">Loại góp ý</label><select id="feedback-category" name="category" className={`${field} mt-2`}>{Object.entries(FEEDBACK_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div><label htmlFor="feedback-title" className="block text-sm font-semibold">Tiêu đề</label><input id="feedback-title" name="title" value={title} onChange={event => setTitle(event.target.value)} aria-describedby="feedback-title-hint" className={`${field} mt-2`} required minLength={5} maxLength={120} placeholder="Tóm tắt điều bạn muốn gửi" /><p id="feedback-title-hint" className="mt-2 flex justify-between gap-2 text-xs text-ink-secondary"><span>5–120 ký tự</span><span>{title.length}/120</span></p></div>
      <div><label htmlFor="feedback-message" className="block text-sm font-semibold">Nội dung</label><textarea id="feedback-message" name="message" value={message} onChange={event => setMessage(event.target.value)} aria-describedby="feedback-message-hint" className={`${field} mt-2 min-h-36`} required minLength={20} maxLength={3000} rows={5} placeholder="Các bước bạn đã làm, kết quả mong muốn và điều đang gặp… Nếu cần hỗ trợ đơn, ghi mã đơn." /><p id="feedback-message-hint" className="mt-2 flex justify-between gap-2 text-xs text-ink-secondary"><span>{message.trim().length < 20 ? `Cần thêm ${20 - message.trim().length} ký tự mô tả` : 'Đã đủ độ dài mô tả'}</span><span>{message.length}/3.000</span></p></div>
      <details className="text-xs leading-5 text-ink-secondary"><summary className="min-h-11 py-3">Lưu ý trước khi gửi</summary><p>Tối đa 5 yêu cầu trong 24 giờ và 10 yêu cầu đang chờ xử lý. Góp ý không thay cho nút hủy đơn; việc hoàn tiền vẫn được chủ sân xử lý riêng.</p></details>
      <button className="min-h-11 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">{busy ? 'Đang gửi…' : 'Gửi góp ý'}</button>
    </fieldset>
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 text-sm leading-6 text-danger">{error}</p>}
    {sentId && <div role="status" className="mt-4 rounded-control bg-free-fill p-4 text-sm leading-6 text-pitch"><p className="font-semibold">Đã tiếp nhận góp ý.</p><Link href={`/gop-y?${new URLSearchParams(pagePath ? { trang: pagePath } : {})}#gop-y-${sentId}`} className="mt-2 inline-flex min-h-11 items-center font-semibold underline">Xem yêu cầu vừa gửi →</Link></div>}
  </form>;
}
const field = 'min-h-11 w-full rounded-control border border-hairline bg-page px-3 py-3 text-sm font-normal focus:outline-2 focus:outline-pitch';
