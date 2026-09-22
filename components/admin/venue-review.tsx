'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, EyeOff, RotateCcw } from 'lucide-react';
import { Modal } from './modal';
import { HIDE_REASONS } from '@/lib/venue-review';

type Status = 'pending' | 'active' | 'rejected' | 'draft';

/**
 * Duyệt, gỡ xuống hoặc mở lại một cụm sân.
 *
 * Gỡ xuống là hành động thật chứ không phải ẩn cho đẹp: create_booking() từ
 * chối mọi đơn mới của cụm sân không còn 'active'. Đơn khách đã đặt thì giữ
 * nguyên — họ trả cọc cho một khung giờ cụ thể, huỷ hộ là chuyện khác.
 */
export function VenueReview({ venueId, venueName, status }: { venueId: string; venueName: string; status: Status }) {
  const router = useRouter();
  const reasonId = useId();
  const [dialog, setDialog] = useState<'approve' | 'hide' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'draft') {
    return <span className="text-xs text-ink-secondary">Bản nháp của chủ sân</span>;
  }

  async function review(next: 'active' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/venues/${venueId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next === 'rejected' ? { status: next, reason } : { status: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Không lưu được. Hãy thử lại.'); return; }
      setDialog(null);
      setReason('');
      router.refresh();
    } catch {
      setError('Không kết nối được. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {status === 'pending' && (
          <button type="button" onClick={() => setDialog('approve')} disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-control bg-pitch px-3 text-xs font-semibold text-pitch-ink disabled:opacity-50">
            <Check className="size-3.5" aria-hidden="true" /> Duyệt
          </button>
        )}
        {status === 'active' && (
          <button type="button" onClick={() => setDialog('hide')} disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-control border border-hairline px-3 text-xs font-semibold text-danger disabled:opacity-50">
            <EyeOff className="size-3.5" aria-hidden="true" /> Gỡ xuống
          </button>
        )}
        {status === 'rejected' && (
          <button type="button" onClick={() => review('active')} disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch disabled:opacity-50">
            <RotateCcw className="size-3.5" aria-hidden="true" /> {busy ? 'Đang mở…' : 'Mở lại'}
          </button>
        )}
        {status === 'pending' && (
          <button type="button" onClick={() => setDialog('hide')} disabled={busy}
            className="flex h-9 items-center rounded-control border border-hairline px-3 text-xs font-semibold text-danger disabled:opacity-50">
            Từ chối
          </button>
        )}
      </div>

      {error && !dialog && <span role="alert" className="max-w-56 text-right text-xs leading-snug text-danger">{error}</span>}

      <Modal open={dialog === 'approve'} onClose={() => setDialog(null)} title="Duyệt cụm sân" description={venueName}>
        <div className="rounded-control border border-hairline bg-sunk p-4 text-[13px] leading-relaxed text-ink-secondary">
          Duyệt xong, cụm sân hiện trên trang tìm sân và bắt đầu nhận đặt ngay. Chủ sân
          phải đã được duyệt hồ sơ thì mới mở được.
        </div>
        {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-relaxed text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setDialog(null)} disabled={busy}
            className="h-11 rounded-control border border-hairline px-5 text-sm font-semibold">Thôi</button>
          <button type="button" onClick={() => review('active')} disabled={busy}
            className="h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink disabled:opacity-60">
            {busy ? 'Đang duyệt…' : 'Duyệt cụm sân'}
          </button>
        </div>
      </Modal>

      <Modal open={dialog === 'hide'} onClose={() => setDialog(null)}
        title={status === 'pending' ? 'Từ chối cụm sân' : 'Gỡ cụm sân xuống'} description={venueName}>
        <div className="flex flex-col gap-2 rounded-control border border-danger/25 bg-danger/[0.04] p-4 text-[13px] leading-relaxed">
          <span className="font-semibold text-danger">Gỡ xuống sẽ</span>
          <ul className="flex flex-col gap-1 text-ink-secondary">
            <li>· Ẩn cụm sân khỏi trang tìm sân và chặn mọi đơn đặt mới.</li>
            <li>· <strong className="font-semibold text-ink">Giữ nguyên đơn khách đã đặt</strong> — khách đã trả cọc cho khung giờ của họ.</li>
            <li>· Gửi lý do bên dưới tới chủ sân. Sửa xong, bạn mở lại được.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2.5">
          <label htmlFor={reasonId} className="text-sm font-semibold">
            Lý do <span className="font-normal text-ink-secondary">(bắt buộc)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {HIDE_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`rounded-pill border px-3 py-1.5 text-left text-[13px] transition-colors ${
                  reason === r ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline hover:border-strong'
                }`}>
                {r}
              </button>
            ))}
          </div>
          <textarea id={reasonId} rows={3} value={reason} maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ghi rõ cần sửa gì để chủ sân làm rồi báo lại."
            className="resize-none rounded-control border border-hairline bg-page p-3 text-[15px] focus:border-pitch focus:outline-none" />
        </div>

        {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-relaxed text-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setDialog(null)} disabled={busy}
            className="h-11 rounded-control border border-hairline px-5 text-sm font-semibold">Thôi</button>
          <button type="button" onClick={() => review('rejected')} disabled={busy || reason.trim().length < 5}
            className="h-11 rounded-control bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Đang lưu…' : status === 'pending' ? 'Từ chối' : 'Gỡ xuống'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
