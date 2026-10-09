'use client';

import { useEffect, useRef, useState } from 'react';
import { playMotion } from '@/lib/motion';
import { ArrowRight, Check, Clock3, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { CANCEL_WINDOW_HOURS } from '@/lib/constants';
import { normalizePhone } from '@/lib/profile';
import { savePendingBookingRequest, clearPendingBookingRequest, BOOKING_REQUEST_EVENT } from '@/lib/pending-booking-request';
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
  userId,
  onCancel,
}: {
  selection: Selection;
  depositPct: number;
  defaultName?: string | null;
  defaultPhone?: string | null;
  defaultNote?: string;
  isAuthenticated: boolean;
  userId?: string;
  onCancel: (contact: { name: string; phone: string; note: string }) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (formRef.current) return playMotion(formRef.current, { opacity: [0, 1] }, { duration: 0.32 });
  }, []);
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(normalizePhone(defaultPhone ?? ''));
  const [note, setNote] = useState(defaultNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const requestId = useRef<string | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);

  useEffect(() => { if (error) feedback.current?.focus(); }, [error]);

  function showUncertainResult() {
    setUncertain(true);
    window.dispatchEvent(new Event(BOOKING_REQUEST_EVENT));
    setError('Chưa nhận được kết quả tạo đơn. Đơn có thể đã được tạo và đang giữ sân. Hãy kiểm tra Đơn của tôi trước khi đặt lại để tránh tạo thêm đơn.');
  }

  const deposit = Math.min(selection.total, Math.ceil((selection.total * depositPct) / 100 / 1000) * 1000);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || uncertain) return;
    const normalizedPhone = normalizePhone(phone);
    setPhone(normalizedPhone);
    if (!/^0\d{9}$/.test(normalizedPhone)) { setError('Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0 (hoặc +84).'); return; }
    submitting.current = true;
    setBusy(true);
    setError(null);

    const intent = {
      request_user_id: userId,
      request_id: requestId.current ??= crypto.randomUUID(),
      court_id: selection.courtId, starts_at: selection.startsAt, ends_at: selection.endsAt,
      customer_name: name.trim() || undefined, customer_phone: normalizedPhone, note: note.trim() || undefined,
    };
    if (userId) savePendingBookingRequest({ userId, body: intent });

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intent),
      });

      if (res.status === 401) {
        clearPendingBookingRequest(intent.request_id);
        requestId.current = null;
        // Giữ cả form và khung đã chọn để đăng nhập xong quay lại đặt tiếp.
        try { sessionStorage.setItem('san-ngon:booking-draft', JSON.stringify({
          selection, name, phone, note, pathname, savedAt: Date.now(),
        })); } catch { /* Sign-in remains available when storage is blocked. */ }
        router.push(`/dang-nhap?next=${encodeURIComponent(pathname + window.location.search)}`);
        return;
      }

      if (res.status >= 500) { showUncertainResult(); return; }
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409 && json.request_conflict) { showUncertainResult(); return; }
        clearPendingBookingRequest(intent.request_id);
        requestId.current = null;
        setError(json.error ?? 'Không đặt được sân.'); return;
      }
      if (!/^SAN[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(json.booking?.code ?? '')) { showUncertainResult(); return; }
      clearPendingBookingRequest(intent.request_id);
      try { sessionStorage.removeItem('san-ngon:booking-draft'); } catch { /* Storage can be blocked; the server-created order still opens. */ }
      router.push(`/dat-san/${json.booking.code}`);
    } catch {
      showUncertainResult();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={busy} className="flex flex-col gap-5 overflow-hidden rounded-[20px] border border-strong bg-card p-5 sm:p-6">
      <ol aria-label="Tiến trình đặt sân" className="flex items-center justify-between gap-2 border-b border-hairline pb-4 text-[11px] font-semibold">
        <li className="flex items-center gap-1.5 text-pitch"><Check className="size-3.5" aria-hidden="true" />Chọn giờ</li><li aria-hidden="true" className="h-px min-w-3 flex-1 bg-hairline" /><li aria-current="step" className="text-pitch">Thông tin</li><li aria-hidden="true" className="h-px min-w-3 flex-1 bg-hairline" /><li className="text-ink-secondary">Thanh toán</li>
      </ol>
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Bước 2 · Thông tin đặt sân</p><h2 className="mt-2 font-display text-xl font-bold text-pitch">Kiểm tra trước khi giữ chỗ</h2></div>
      <div className="flex flex-col gap-3 rounded-control border border-hairline bg-page p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-display text-lg font-extrabold text-pitch">{selection.courtName}</span>
            <span className="text-sm font-semibold text-pitch">{dayLabel(new Date(selection.startsAt))}</span>
            <span className="text-sm text-ink-secondary">
              {hhmm(selection.startsAt)} – {hhmm(selection.endsAt)} · {selection.slots.length} khung
            </span>
          </div>
          <span className="shrink-0 rounded-pill bg-sunk px-2.5 py-1 text-xs text-ink-secondary">{uncertain ? 'Chưa rõ trạng thái' : 'Chưa giữ chỗ'}</span>
        </div>
        <p className="text-sm leading-relaxed text-ink-secondary">
          {uncertain
            ? 'Kiểm tra đơn vừa đặt trong Đơn của tôi. Nếu đã có mã đơn, mở đơn đó để tiếp tục thanh toán; đừng tạo đơn mới.'
            : isAuthenticated
            ? 'Bấm giữ chỗ sẽ tạo một mã đơn mới và giữ khung giờ 15 phút để bạn chuyển cọc. Chưa nhận cọc khi hết hạn, sân tự mở lại.'
            : 'Nhập thông tin liên hệ, sau đó đăng nhập để tiếp tục đặt sân. Khung giờ chưa được giữ ở bước này.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ten" className="text-sm font-semibold">Tên người đặt</label>
        <input id="ten" value={name} onChange={(e) => setName(e.target.value)}
          required maxLength={100} autoComplete="name" placeholder="Nguyễn Văn A"
          className="h-12 rounded-control border border-hairline px-3.5 focus:border-pitch focus:outline-none" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sdt" className="text-sm font-semibold">Số điện thoại</label>
        <input id="sdt" type="tel" required inputMode="tel"
          maxLength={30} title="Nhập số điện thoại bắt đầu bằng 0 hoặc +84" autoComplete="tel" placeholder="0912345678"
          value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhone(normalizePhone(phone))}
          className="h-12 rounded-control border border-hairline px-3.5 focus:border-pitch focus:outline-none" />
        <span className="text-xs text-ink-secondary">Có thể nhập dấu cách hoặc +84. Chủ sân gọi số này nếu có thay đổi.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ghichu" className="text-sm font-semibold">
          Ghi chú <span className="font-normal text-ink-secondary">(không bắt buộc)</span>
        </label>
        <textarea id="ghichu" maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Cần thuê thêm bóng, áo bib…"
          className="resize-none rounded-control border border-hairline p-3" />
      </div>

      {!isAuthenticated && (
        <div className="flex gap-3 rounded-control border border-strong bg-free-fill p-3.5 text-sm text-free-ink">
          <LogIn className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            Bước tiếp theo: đăng nhập bằng Google hoặc email. Thông tin vừa nhập được giữ lại để bạn tiếp tục đặt sân.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-control border border-free-line bg-free-fill p-4 text-sm">
        <Row label="Tổng tiền sân" value={vnd(selection.total)} />
        <Row label={`Cọc trước ${depositPct}%`} value={vnd(deposit)} />
        <div className="h-px bg-strong" />
        {deposit >= selection.total
          ? <p className="text-sm leading-6 text-free-ink">Cọc bằng toàn bộ tiền sân. Sau khi nhận đủ cọc, bạn không cần trả thêm tiền sân khi đến chơi.</p>
          : <Row label="Trả tại sân" value={vnd(selection.total - deposit)} />}
      </div>

      <p className="text-xs leading-5 text-ink-secondary">Theo chính sách hiện tại, hủy trước giờ chơi ít nhất {CANCEL_WINDOW_HOURS} tiếng được hoàn cọc; hoàn tiền được xử lý thủ công. <Link href="/chinh-sach-huy" target="_blank" rel="noopener noreferrer" className="font-semibold text-pitch underline underline-offset-2">Xem chính sách (mở tab mới)</Link>.</p>

      {error && <p ref={feedback} tabIndex={-1} role="alert" className="rounded-control border border-danger/30 p-3 text-sm leading-6 text-danger">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={busy || uncertain} onClick={() => {
          try { sessionStorage.removeItem('san-ngon:booking-draft'); } catch { /* Keep choosing hours available when storage is blocked. */ }
          onCancel({ name, phone, note });
        }}
          className="pf-action inline-flex min-h-11 items-center justify-center rounded-control border border-hairline px-4 text-sm font-semibold hover:bg-sunk disabled:opacity-60">
          Chọn lại
        </button>
        {uncertain ? <Link href="/don-cua-toi?filter=all" className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink">Kiểm tra Đơn của tôi<ArrowRight className="size-4" aria-hidden="true" /></Link> : <button type="submit" disabled={busy}
          className="pf-action inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-pitch px-4 py-2 text-sm font-semibold text-pitch-ink hover:bg-ink disabled:opacity-60">
          {busy && <span aria-hidden="true" className="pf-spin size-3.5 rounded-full border-2 border-white/40 border-t-white" />}{busy ? (isAuthenticated ? 'Đang tạo đơn…' : 'Đang chuyển…') : isAuthenticated ? 'Giữ chỗ 15 phút' : 'Đăng nhập để tiếp tục'}{!busy && <ArrowRight className="pf-arrow size-4" aria-hidden="true" />}
        </button>}
      </div>

      <p className="flex items-start gap-2 text-xs leading-6 text-ink-secondary"><Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Sau khi tạo đơn, bạn có 15 phút để chuyển cọc. Lịch đặt chỉ được xác nhận khi đã nhận đủ cọc.</p>
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
