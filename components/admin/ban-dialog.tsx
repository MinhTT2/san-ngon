'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './modal';
import type { AdminUserRow } from '@/lib/types';

/** Lý do bấm một phát cho nhanh. Vẫn sửa được thành câu riêng. */
const QUICK_REASONS = [
  'Đặt sân rồi bỏ nhiều lần',
  'Số điện thoại không liên lạc được',
  'Gây rối với chủ sân',
  'Nghi ngờ tài khoản ảo',
];

export function BanDialog({
  user,
  open,
  onClose,
}: {
  user: AdminUserRow;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ban() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? 'Không khoá được tài khoản.'); return; }
    setReason('');
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Khoá tài khoản"
      description={`${user.full_name ?? 'Chưa đặt tên'} · ${user.email}`}
    >
      {/* Không dùng nền hổ phách ở đây: màu đó dành riêng cho giờ vàng và đơn
          chờ thanh toán. Cảnh báo phá huỷ đi theo màu đỏ như nút xác nhận. */}
      <div className="flex flex-col gap-2 rounded-control border border-danger/25 bg-danger/[0.04] p-4 text-[13px] leading-relaxed">
        <span className="font-semibold text-danger">Khoá xong sẽ xảy ra ba việc</span>
        <ul className="flex flex-col gap-1">
          <li>· Người này bị đăng xuất khỏi mọi thiết bị và không đăng nhập lại được.</li>
          <li>· Không đặt sân, không đăng sân, không huỷ đơn được nữa.</li>
          <li>
            · {user.so_don > 0
              ? 'Đơn đang chờ chuyển khoản bị huỷ, khung giờ mở lại cho người khác. Đơn đã xác nhận giữ nguyên.'
              : 'Tài khoản này chưa có đơn nào.'}
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="ban-reason" className="text-sm font-semibold">
          Lý do khoá <span className="font-normal text-ink-secondary">(bắt buộc)</span>
        </label>

        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] transition-colors ${
                reason === r ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline hover:border-strong'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <textarea
          id="ban-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ghi rõ để sáu tháng sau còn tra lại được vì sao khoá."
          className="resize-none rounded-control border border-hairline bg-page p-3 text-[15px] focus:border-pitch focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={busy}
          className="h-11 rounded-control border border-hairline px-5 text-sm font-semibold">
          Thôi
        </button>
        <button type="button" onClick={ban} disabled={busy || reason.trim().length < 3}
          className="h-11 rounded-control bg-danger px-5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Đang khoá…' : 'Khoá tài khoản'}
        </button>
      </div>
    </Modal>
  );
}
