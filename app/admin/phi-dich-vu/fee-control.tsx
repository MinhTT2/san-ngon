'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FeeControl({ ownerId, required }: { ownerId: string; required: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_fee', owner_id: ownerId, required: !required }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setConfirming(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được.'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-xs text-sm">
    {!confirming ? <button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-control border border-hairline px-4 font-semibold text-pitch">{required ? 'Miễn phí tài khoản này' : 'Bật thu phí 299.000đ/tháng'}</button> : <>
      <p className="leading-6 text-ink-secondary">{required ? 'Tắt thu phí sẽ bỏ giới hạn do hết hạn phí. Các điều kiện duyệt sân và kết nối ngân hàng vẫn áp dụng.' : 'Tài khoản chưa có hạn thanh toán sẽ dừng đăng sân và nhận đơn mới ngay khi bật. Đơn cũ vẫn được xử lý.'}</p>
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={save} className="min-h-11 rounded-control bg-pitch px-4 font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang lưu…' : 'Xác nhận'}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 rounded-control border border-hairline px-4">Quay lại</button></div>
    </>}
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
  </div>;
}
