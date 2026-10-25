'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BUTTON = 'pf-action min-h-11 rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-50';
export function VipBuyButton({ id }: { id?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/vip', { method: id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: id ? JSON.stringify({ id }) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa gửi được yêu cầu.'); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={submit} className={BUTTON}>{busy ? 'Đang xử lý…' : id ? 'Tôi đã chuyển khoản · Gửi admin duyệt' : 'Mua / gia hạn VIP · 49.000đ'}</button>{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</div>;
}

export function VipReviewForm({ id }: { id: string }) {
  const router = useRouter();
  const [transaction, setTransaction] = useState('');
  const [reason, setReason] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function review(approve: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/vip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, approve, transaction_id: transaction, verified, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa xử lý được.'); }
    finally { setBusy(false); }
  }
  const input = 'mt-2 min-h-11 w-full rounded-control border border-hairline bg-page px-3 py-2 text-sm';
  return <div data-unsaved-busy={busy} data-unsaved-changes={!!transaction || !!reason || verified} className="mt-5 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-2">
    <div><label className="text-sm font-semibold">ID giao dịch SePay<input value={transaction} maxLength={30} inputMode="numeric" onChange={e => setTransaction(e.target.value)} className={input} /></label><label className="mt-3 flex items-start gap-2 text-xs leading-6"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1 size-4" />Đã kiểm tra đủ 49.000đ, đúng người nhận và mã VIP trên giao dịch tiền vào.</label><button type="button" disabled={busy || !verified || !/^[1-9]\d{0,29}$/.test(transaction.trim())} onClick={() => review(true)} className={`${BUTTON} mt-3`}>Duyệt VIP 1 tháng</button></div>
    <div><label className="text-sm font-semibold">Lý do chưa duyệt<textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className={input} placeholder="Nêu thông tin khách cần bổ sung hoặc cách đối soát." /></label><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => review(false)} className="mt-3 min-h-11 rounded-control border border-danger/30 px-4 text-sm font-semibold text-danger disabled:opacity-50">Chưa duyệt · Gửi lý do</button></div>
    {error && <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p>}
  </div>;
}
