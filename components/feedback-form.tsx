'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FEEDBACK_CATEGORIES } from '@/lib/feedback';

export function FeedbackForm({ pagePath }: { pagePath: string | null }) {
  const router = useRouter();
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  return <form className="rounded-card border border-hairline bg-card p-5 sm:p-7" onSubmit={async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const payload = { category: fields.get('category'), title: fields.get('title'), message: fields.get('message'), page_path: pagePath };
    const serialized = JSON.stringify(payload);
    if (request.current?.payload !== serialized) request.current = { payload: serialized, id: crypto.randomUUID() };
    setBusy(true); setError(''); setSent(false);
    try {
      const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: request.current.id }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? 'Chưa gửi được góp ý.'); return; }
      form.reset(); request.current = null; setSent(true); router.refresh();
    } catch { setError('Kết nối bị gián đoạn. Bạn có thể thử lại cùng nội dung; hệ thống không tạo yêu cầu trùng.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-display text-xl font-bold text-pitch">Gửi góp ý mới</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">Chỉ bạn và quản trị đọc được nội dung. Không gửi mật khẩu, mã OTP hoặc thông tin tài khoản ngân hàng.</p>
    {pagePath && <p className="mt-3 break-all text-xs text-ink-secondary">Trang liên quan: {pagePath}</p>}
    <fieldset disabled={busy} className="mt-5 space-y-4 disabled:opacity-60">
      <label className="block text-sm font-semibold">Loại góp ý<select name="category" className={`${field} mt-2`}>{Object.entries(FEEDBACK_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block text-sm font-semibold">Tiêu đề<input name="title" className={`${field} mt-2`} required minLength={5} maxLength={120} placeholder="Ví dụ: Không chọn được khung giờ trên điện thoại" /></label>
      <label className="block text-sm font-semibold">Nội dung<textarea name="message" className={`${field} mt-2 min-h-40`} required minLength={20} maxLength={3000} rows={6} placeholder="Bạn đang làm gì, gặp vấn đề ở bước nào, hoặc muốn cải thiện điều gì? Nếu liên quan đơn, ghi mã đơn để hỗ trợ kiểm tra." /></label>
      <p className="text-xs leading-5 text-ink-secondary">Tối đa 5 yêu cầu trong 24 giờ và 10 yêu cầu đang chờ xử lý. Góp ý không thay cho nút hủy đơn; việc hoàn tiền vẫn được chủ sân xử lý riêng.</p>
      <button className="min-h-11 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">{busy ? 'Đang gửi…' : 'Gửi góp ý'}</button>
    </fieldset>
    {error && <p role="alert" className="mt-4 text-sm leading-6 text-danger">{error}</p>}
    {sent && <p role="status" className="mt-4 text-sm leading-6 text-success">Đã tiếp nhận. Bạn có thể theo dõi và đọc phản hồi trong danh sách bên dưới.</p>}
  </form>;
}
const field = 'min-h-11 w-full rounded-control border border-hairline bg-page px-3 py-3 text-sm font-normal focus:outline-2 focus:outline-pitch';
