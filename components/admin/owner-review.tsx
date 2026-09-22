'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Modal } from './modal';
import { ownerChecklist, REJECT_REASONS, type OwnerApplication } from '@/lib/owner-review';

type Size = 'row' | 'page';

/**
 * Duyệt hoặc từ chối một hồ sơ chủ sân.
 *
 * Cả hai nhánh đều đi qua hộp thoại, không bấm một phát là xong: duyệt nghĩa là
 * cho người này nhận tiền cọc của khách, từ chối nghĩa là bắt họ làm lại hồ sơ.
 * Nút Duyệt tự khoá khi hồ sơ còn thiếu, thay vì để admin bấm rồi ăn lỗi server.
 */
export function OwnerReview({
  ownerId,
  owner,
  size = 'row',
}: {
  ownerId: string;
  owner: OwnerApplication;
  size?: Size;
}) {
  const router = useRouter();
  // Mỗi hồ sơ trong danh sách dựng một hộp thoại riêng, nên id phải duy nhất
  // theo từng thẻ — dùng chung một chuỗi thì <label> trỏ vào ô của hồ sơ khác.
  const reasonId = useId();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = ownerChecklist(owner);
  const missing = checks.filter((item) => !item.ok);
  const name = owner.full_name?.trim() || 'Hồ sơ này';

  async function review(status: 'active' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/owners/${ownerId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(status === 'rejected' ? { status, reason } : { status }),
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

  const big = size === 'page';

  return (
    <div className={`flex flex-col gap-2 ${big ? 'items-stretch' : 'items-end'}`}>
      <div className={`flex gap-2 ${big ? 'flex-col' : ''}`}>
        <button
          type="button"
          onClick={() => setDialog('approve')}
          disabled={busy || missing.length > 0}
          title={missing.length ? `Còn thiếu: ${missing.map((m) => m.label.toLowerCase()).join(', ')}` : undefined}
          className={`flex items-center justify-center gap-2 rounded-control bg-pitch font-semibold text-pitch-ink disabled:opacity-40 ${
            big ? 'h-12 px-5 text-sm' : 'h-9 px-3 text-xs'
          }`}
        >
          <Check className={big ? 'size-4' : 'size-3.5'} aria-hidden="true" />
          Duyệt chủ sân
        </button>
        <button
          type="button"
          onClick={() => setDialog('reject')}
          disabled={busy}
          className={`flex items-center justify-center gap-2 rounded-control border border-hairline font-semibold text-danger disabled:opacity-40 ${
            big ? 'h-12 px-5 text-sm' : 'h-9 px-3 text-xs'
          }`}
        >
          <X className={big ? 'size-4' : 'size-3.5'} aria-hidden="true" />
          Từ chối
        </button>
      </div>

      {missing.length > 0 && (
        <p className={`text-xs leading-snug text-ink-secondary ${big ? '' : 'max-w-56 text-right'}`}>
          Chưa duyệt được: còn thiếu {missing.map((m) => m.label.toLowerCase()).join(', ')}.
        </p>
      )}

      {error && !dialog && (
        <p role="alert" className={`text-xs leading-snug text-danger ${big ? '' : 'max-w-56 text-right'}`}>{error}</p>
      )}

      <Modal
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        title="Duyệt hồ sơ chủ sân"
        description={name}
      >
        <div className="flex flex-col gap-2 rounded-control border border-hairline bg-sunk p-4 text-[13px] leading-relaxed">
          <span className="font-semibold">Duyệt xong, người này sẽ</span>
          <ul className="flex flex-col gap-1 text-ink-secondary">
            <li>· Đăng được cụm sân và sân con lên trang tìm sân.</li>
            <li>· Nhận tiền cọc của khách vào tài khoản đã khai bên dưới.</li>
          </ul>
          <dl className="mt-1 flex flex-col gap-1 border-t border-hairline pt-2.5">
            {checks.map((item) => (
              <div key={item.key} className="flex justify-between gap-4">
                <dt className="text-ink-secondary">{item.label}</dt>
                <dd className="text-right font-medium">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        {error && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-relaxed text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setDialog(null)} disabled={busy}
            className="h-11 rounded-control border border-hairline px-5 text-sm font-semibold">Thôi</button>
          <button type="button" onClick={() => review('active')} disabled={busy}
            className="h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink disabled:opacity-60">
            {busy ? 'Đang duyệt…' : 'Duyệt chủ sân'}
          </button>
        </div>
      </Modal>

      <Modal
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Từ chối hồ sơ"
        description={name}
      >
        <div className="rounded-control border border-hairline bg-sunk p-4 text-[13px] leading-relaxed text-ink-secondary">
          Lý do này gửi thẳng tới chủ sân trong thông báo, và lưu lại trong hồ sơ.
          Họ sửa xong là gửi lại được ngay — viết rõ thì đỡ một vòng gọi điện.
        </div>

        <div className="flex flex-col gap-2.5">
          <label htmlFor={reasonId} className="text-sm font-semibold">
            Lý do từ chối <span className="font-normal text-ink-secondary">(bắt buộc)</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-pill border px-3 py-1.5 text-left text-[13px] transition-colors ${
                  reason === r ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline hover:border-strong'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            id={reasonId}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Ghi rõ cần bổ sung gì để họ gửi lại được ngay."
            className="resize-none rounded-control border border-hairline bg-page p-3 text-[15px] focus:border-pitch focus:outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-relaxed text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setDialog(null)} disabled={busy}
            className="h-11 rounded-control border border-hairline px-5 text-sm font-semibold">Thôi</button>
          <button type="button" onClick={() => review('rejected')} disabled={busy || reason.trim().length < 5}
            className="h-11 rounded-control bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Đang gửi…' : 'Từ chối hồ sơ'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
