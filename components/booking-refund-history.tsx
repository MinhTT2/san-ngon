'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/modal';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import type { BookingRefund } from '@/lib/booking-refunds';

type Transfer = { id: string; amount: number; reference: string; transferred_at: string };
const dateTime = (value: string) => `${dayLabel(new Date(value))}/${ymd(new Date(value)).slice(0, 4)} · ${hhmm(value)}`;

export function BookingRefundHistory({ code, record = false }: { code: string; record?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<BookingRefund | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uncertain, setUncertain] = useState<Transfer | null>(null);
  const [draft, setDraft] = useState({ amount: '', reference: '', transferred_at: '' });
  const sending = useRef(false);
  const request = useRef<Transfer | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);

  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setSummary(null); setError(''); setSuccess('');
    fetch(`/api/bookings/${code}/refund`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.refund) throw new Error(body.error || 'Chưa tải được lịch sử hoàn tiền.');
        if (controller.signal.aborted) return;
        setSummary(body.refund);
        setDraft(old => ({ ...old, transferred_at: old.transferred_at || body.refund.local_now }));
      }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Chưa tải được lịch sử.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, code]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !summary) return;
    const payload = uncertain ?? { id: crypto.randomUUID(), amount: Number(draft.amount), reference: draft.reference.trim(), transferred_at: draft.transferred_at };
    request.current = payload;
    sending.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch(`/api/bookings/${code}/refund`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
      });
      const body = await response.json().catch(() => null);
      if (!body || (response.ok && !body.refund) || response.status >= 500) throw new Error('UNKNOWN_RESULT');
      if (!response.ok) {
        setUncertain(null); setError(body.error || 'Chưa ghi nhận được khoản hoàn.');
        return;
      }
      setSummary(body.refund); setUncertain(null); request.current = null;
      setDraft({ amount: '', reference: '', transferred_at: body.refund.local_now });
      setSuccess('Đã ghi nhận khoản chuyển hoàn.'); router.refresh();
    } catch {
      setUncertain(request.current);
      setError('Chưa nhận được kết quả. Thông tin được giữ nguyên; thử lại cùng yêu cầu để tránh ghi hai lần. Không chuyển tiền lần nữa.');
    } finally { sending.current = false; setBusy(false); }
  }

  const fieldClass = 'mt-1 min-h-11 w-full rounded-control border border-hairline bg-page px-3 py-2 font-normal';
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="pf-action min-h-11 rounded-control border border-hairline px-3 py-2 text-left text-sm font-semibold text-pitch">
      {record ? 'Ghi nhận hoàn tiền' : 'Lịch sử hoàn tiền'}
    </button>
    {open && <Modal title={record ? 'Ghi nhận hoàn tiền' : 'Lịch sử hoàn tiền'} subtitle={`Đơn ${code}`} size="max-w-lg" onClose={() => { if (!sending.current) setOpen(false); }}>
      {loading && <p role="status">Đang tải lịch sử…</p>}
      {error && <p ref={feedback} tabIndex={-1} role="alert" className="mb-4 rounded-control border border-danger/30 p-3 text-sm leading-6 text-danger">{error}</p>}
      {!loading && !summary && <button type="button" onClick={() => { setOpen(false); }} className="min-h-11 text-sm text-pitch underline">Đóng và mở lại để thử tải</button>}
      {success && <p role="status" className="mb-4 text-sm text-success">{success}</p>}
      {summary && <div className="space-y-5">
        <p className="break-words text-sm leading-6">{summary.customer_name || 'Khách đặt sân'} · {summary.customer_phone}<br />{summary.court_name || 'Sân đã đặt'}</p>
        <dl className="grid grid-cols-2 gap-3 rounded-control border border-hairline bg-page p-4 text-sm">
          <div><dt className="text-ink-secondary">Tiền nhận đã ghi nhận</dt><dd className="mt-1 font-semibold">{vnd(summary.received)}</dd></div>
          <div><dt className="text-ink-secondary">Hoàn có tham chiếu</dt><dd className="mt-1 font-semibold">{vnd(summary.refunded)}</dd></div>
          {!summary.legacy && <div className="col-span-2 border-t border-hairline pt-3"><dt className="text-ink-secondary">Còn chờ hoàn</dt><dd className="font-display text-2xl font-bold text-pitch">{vnd(summary.remaining)}</dd></div>}
        </dl>
        {summary.legacy && <p className="text-sm leading-6 text-ink-secondary">Đơn đã được đánh dấu hoàn trước khi có sổ chứng từ. Chưa có dữ liệu xác nhận số tiền, người và thời gian chuyển hoàn; liên hệ chủ sân để đối soát lịch sử.</p>}
        {summary.retained > 0 && <p className="text-sm leading-6 text-ink-secondary">Cọc giữ lại theo chính sách hủy/không đến: {vnd(summary.retained)}. Khoản này không nằm trong số tiền chờ hoàn.</p>}
        {!summary.legacy && summary.status === 'needed' && !summary.received && <p className="text-sm leading-6 text-ink-secondary">Chưa có số tiền nhận đủ căn cứ để ghi hoàn. Cần kiểm tra Sổ tiền vào và chứng từ ngân hàng trước.</p>}
        {summary.records.length > 0 ? <ul aria-label="Các khoản chuyển hoàn" className="space-y-3">{summary.records.map(item => <li key={item.id} className="rounded-control border border-hairline p-4 text-sm">
          <p className="font-semibold text-pitch">{vnd(item.amount)}</p>
          <p className="mt-1 break-all">Tham chiếu: {item.reference}</p>
          <p className="mt-1 text-ink-secondary">Chuyển: {dateTime(item.transferred_at)}</p>
          <p className="mt-1 text-ink-secondary">Ghi nhận bởi {item.actor_name || 'Chủ sân'} · {dateTime(item.recorded_at)}</p>
        </li>)}</ul> : !summary.legacy && <p className="text-sm text-ink-secondary">Chưa có khoản chuyển hoàn được ghi nhận.</p>}
        {record && (summary.can_record || uncertain) && <form onSubmit={submit} data-unsaved-changes={!!draft.amount || !!draft.reference} data-unsaved-busy={busy} className="space-y-4 border-t border-hairline pt-4">
          <p className="text-sm leading-6 text-ink-secondary">Ghi sau khi đã chuyển tiền qua ngân hàng. Có thể ghi từng phần; đơn chỉ hoàn tất khi đủ số tiền. Dùng mã giao dịch hoàn tiền, không dùng mã chuyển cọc. Thông tin đã ghi không sửa/xóa được.</p>
          <fieldset disabled={busy || !!uncertain} className="space-y-3 disabled:opacity-60">
            <label className="block text-sm font-semibold">Số tiền đã chuyển hoàn (đồng)<input type="number" required min={1} max={summary.remaining} step={1} value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} className={fieldClass} /></label>
            <label className="block text-sm font-semibold">Mã tham chiếu chuyển hoàn<input required minLength={3} maxLength={200} value={draft.reference} onChange={e => setDraft({ ...draft, reference: e.target.value })} className={fieldClass} /></label>
            <label className="block text-sm font-semibold">Thời gian chuyển (giờ Việt Nam)<input type="datetime-local" required max={summary.local_now} value={draft.transferred_at} onChange={e => setDraft({ ...draft, transferred_at: e.target.value })} className={fieldClass} /></label>
            <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required className="mt-1 size-4 accent-pitch" />Tôi đã chuyển số tiền trên cho khách và kiểm tra đúng mã tham chiếu.</label>
          </fieldset>
          <button type="submit" disabled={busy} className="min-h-11 rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang ghi nhận…' : uncertain ? 'Thử lại cùng yêu cầu' : 'Lưu khoản đã chuyển hoàn'}</button>
        </form>}
      </div>}
    </Modal>}
  </>;
}
