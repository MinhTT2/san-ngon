'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { vietQrUrl } from '@/lib/sepay';
import { vnd } from '@/lib/format';
import type { SubscriptionInvoice } from '@/lib/subscriptions';

export function PaymentPanel({ invoice }: { invoice: SubscriptionInvoice | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createInvoice() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invoice' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Không kết nối được.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-card border border-hairline bg-card p-5 sm:p-8">
    <h2 className="font-display text-2xl font-bold text-pitch">Thanh toán một tháng</h2>
    <p className="mt-3 text-sm leading-7 text-ink-secondary">299.000đ cho tất cả cụm sân của bạn. Gia hạn sớm được cộng tiếp từ hạn hiện tại; nếu đã hết hạn, tháng mới bắt đầu khi hệ thống nhận đủ phí.</p>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {invoice ? <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={vietQrUrl(invoice.code, invoice.amount, invoice.bank, invoice.account_number)} alt={`QR chuyển ${vnd(invoice.amount)} phí sử dụng website, nội dung ${invoice.code}`} className="w-[220px] max-w-full rounded-control border border-hairline" />
      <div><dl className="space-y-3 text-sm">{[['Ngân hàng', invoice.bank], ['Số tài khoản', invoice.account_number], ['Người nhận', invoice.account_name], ['Số tiền', vnd(invoice.amount)], ['Nội dung chuyển khoản', invoice.code]].map(([label, value]) => <div key={label}><dt className="text-ink-secondary">{label}</dt><dd className="mt-1 break-all font-semibold text-pitch">{value}</dd></div>)}</dl>
      <p role="status" className="mt-5 text-sm text-peak-ink">Đang chờ chuyển khoản. Trang sẽ tự cập nhật khi nhận đủ phí.</p>
      <p className="mt-3 text-xs leading-6 text-ink-secondary">Chuyển đủ tiền trong một giao dịch và giữ nguyên nội dung. Nếu đã chuyển thiếu hoặc chuyển trùng, liên hệ quản trị viên để đối soát trước khi chuyển tiếp.</p>
      <button type="button" onClick={() => router.refresh()} className="mt-4 min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Kiểm tra trạng thái</button></div>
    </div> : <button type="button" disabled={busy} onClick={createInvoice} className="mt-6 min-h-12 rounded-control bg-pitch px-6 font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang tạo mã…' : 'Lấy mã QR thanh toán 299.000đ'}</button>}
  </section>;
}
