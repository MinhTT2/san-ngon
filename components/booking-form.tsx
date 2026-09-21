'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { hhmm, vnd } from '@/lib/format';
import type { Selection } from '@/lib/types';

/**
 * Bước cuối trước khi tạo đơn. Giá hiển thị ở đây chỉ để người dùng đọc —
 * server tính lại toàn bộ, không nhận số tiền từ form này.
 */
export function BookingForm({
  selection,
  depositPct,
  defaultName,
  defaultPhone,
  defaultNote,
  isAuthenticated,
  onCancel,
}: {
  selection: Selection;
  depositPct: number;
  defaultName?: string | null;
  defaultPhone?: string | null;
  defaultNote?: string;
  isAuthenticated: boolean;
  onCancel: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState(defaultNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = Math.ceil((selection.total * depositPct) / 100 / 1000) * 1000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        court_id: selection.courtId,
        starts_at: selection.startsAt,
        ends_at: selection.endsAt,
        customer_name: name || undefined,
        customer_phone: phone,
        note: note || undefined,
      }),
    });

    if (res.status === 401) {
      // Giữ cả form và khung đã chọn để đăng nhập xong quay lại đặt tiếp.
      sessionStorage.setItem('san-ngon:booking-draft', JSON.stringify({
        selection, name, phone, note, savedAt: Date.now(),
      }));
      router.push(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const json = await res.json();
    setBusy(false);

    if (!res.ok) { setError(json.error ?? 'Không đặt được sân.'); return; }
    sessionStorage.removeItem('san-ngon:booking-draft');
    router.push(`/dat-san/${json.booking.code}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-strong bg-card p-5">
      <div className="flex flex-col gap-3 border-b border-hairline pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-display text-lg font-extrabold text-pitch">{selection.courtName}</span>
            <span className="text-sm text-ink-secondary">
              {hhmm(selection.startsAt)} – {hhmm(selection.endsAt)} · {selection.slots.length} giờ
            </span>
          </div>
          <span className="rounded-pill bg-free-fill px-2.5 py-1 text-xs font-semibold text-free-ink">Giữ 15 phút</span>
        </div>
        <p className="text-sm leading-relaxed text-ink-secondary">
          {isAuthenticated
            ? 'Kiểm tra thông tin liên hệ rồi thanh toán cọc để giữ sân.'
            : 'Nhập thông tin để chủ sân biết ai đặt. Bạn chỉ cần xác thực email một lần bằng mã OTP.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ten" className="text-sm font-semibold">Tên người đặt</label>
        <input id="ten" value={name} onChange={(e) => setName(e.target.value)}
          required autoComplete="name" placeholder="Nguyễn Văn A"
          className="h-12 rounded-control border border-hairline px-3.5 focus:border-pitch focus:outline-none" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sdt" className="text-sm font-semibold">Số điện thoại</label>
        <input id="sdt" type="tel" required inputMode="numeric" pattern="0\d{9}"
          autoComplete="tel" placeholder="0912 345 678"
          value={phone} onChange={(e) => setPhone(e.target.value)}
          className="h-12 rounded-control border border-hairline px-3.5 focus:border-pitch focus:outline-none" />
        <span className="text-xs text-ink-secondary">Chủ sân gọi số này nếu có thay đổi.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ghichu" className="text-sm font-semibold">
          Ghi chú <span className="font-normal text-ink-secondary">(không bắt buộc)</span>
        </label>
        <textarea id="ghichu" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Cần thuê thêm bóng, áo bib…"
          className="resize-none rounded-control border border-hairline p-3" />
      </div>

      {!isAuthenticated && (
        <div className="flex gap-3 rounded-control border border-strong bg-free-fill p-3.5 text-sm text-free-ink">
          <span aria-hidden="true" className="mt-0.5 text-base">✦</span>
          <p className="leading-relaxed">
            Chưa có tài khoản? Bước tiếp theo bạn sẽ tạo mật khẩu và nhập mã OTP gửi qua email.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-control bg-free-fill p-4 text-sm">
        <Row label="Tổng tiền sân" value={vnd(selection.total)} />
        <Row label={`Cọc trước ${depositPct}%`} value={vnd(deposit)} />
        <div className="h-px bg-strong" />
        <Row label="Trả tại sân" value={vnd(selection.total - deposit)} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => {
          sessionStorage.removeItem('san-ngon:booking-draft');
          onCancel();
        }}
          className="h-13 flex-grow rounded-control border border-hairline font-semibold">
          Chọn lại
        </button>
        <button type="submit" disabled={busy}
          className="h-13 flex-[2] rounded-control bg-pitch font-semibold text-pitch-ink disabled:opacity-60">
          {busy ? (isAuthenticated ? 'Đang tạo đơn…' : 'Đang chuyển…') : isAuthenticated ? `Đặt cọc ${vnd(deposit)}` : 'Tiếp tục xác thực'}
        </button>
      </div>

      <p className="text-center text-xs text-ink-secondary">Sân được giữ 15 phút để bạn chuyển khoản.</p>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
