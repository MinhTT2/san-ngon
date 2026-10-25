'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Moderation } from '@/lib/content-moderation';
export function ContentModerationForm({ content }: { content: Moderation }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  return <form className="mt-5 space-y-4 rounded-control border border-hairline bg-page p-4" onSubmit={async event => {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/content-moderation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: content.kind, id: content.id, hidden: !content.hidden, reason: fields.get('reason'), updated_at: content.updated_at }) });
      const data = await response.json(); if (!response.ok) { setMessage(data.error || 'Chưa lưu được.'); return; }
      setMessage('Đã cập nhật phạm vi công khai.'); router.refresh();
    } catch { setMessage('Mất kết nối. Tải lại để kiểm tra trạng thái trước khi thao tác lại.'); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-semibold text-pitch">Phạm vi công khai: {content.hidden ? 'Đang tạm ẩn' : 'Đang hiển thị'}</h3>
    <p className="break-words text-sm">{content.title}</p>
    <p className="text-xs leading-6 text-ink-secondary">Ẩn khỏi danh sách và khách mới; người đã đăng ký và người quản lý vẫn xử lý giải, thanh toán và hoàn tiền. Không hủy giải, trả lịch hoặc đổi vai trò tài khoản.</p>
    {content.reason && <p className="break-words text-xs text-ink-secondary">Lý do gần nhất: {content.reason}</p>}
    <label className="block text-sm font-semibold">Lý do gửi cho người đăng<textarea name="reason" required minLength={10} maxLength={1000} disabled={busy} className="mt-2 block min-h-24 w-full rounded-control border border-hairline bg-card p-3 text-sm font-normal" /></label>
    <button disabled={busy} className="min-h-11 rounded-control border border-pitch px-4 text-sm font-semibold text-pitch disabled:opacity-60">{busy ? 'Đang lưu…' : content.hidden ? 'Khôi phục công khai' : 'Tạm ẩn nội dung'}</button>
    {message && <p role="status" className="text-sm leading-6 text-pitch">{message}</p>}
  </form>;
}
