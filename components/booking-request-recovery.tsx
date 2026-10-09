"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOOKING_REQUEST_EVENT, clearPendingBookingRequest, readPendingBookingRequest, type PendingBookingRequest } from '@/lib/pending-booking-request';

/** Recover the exact intent, including after a reload; never match by phone/time alone. */
export function BookingRequestRecovery({ userId }: { userId: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<PendingBookingRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    const load = () => setRequest(readPendingBookingRequest(userId));
    load();
    window.addEventListener(BOOKING_REQUEST_EVENT, load);
    window.addEventListener('pageshow', load);
    return () => {
      window.removeEventListener(BOOKING_REQUEST_EVENT, load);
      window.removeEventListener('pageshow', load);
    };
  }, [userId]);

  async function recover() {
    if (!request || sending.current) return;
    sending.current = true; setBusy(true); setError(null);
    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request.body, request_user_id: request.userId }) });
      const data = await res.json().catch(() => null);
      if (res.ok && /^SAN[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(data?.booking?.code ?? '')) {
        clearPendingBookingRequest(request.body.request_id);
        router.push(`/dat-san/${data.booking.code}`);
        return;
      }
      if (res.status === 401) {
        router.push('/dang-nhap?next=%2Fdon-cua-toi');
        return;
      }
      if (res.status >= 400 && res.status < 500 && !data?.request_conflict) {
        clearPendingBookingRequest(request.body.request_id);
        setRequest(null);
      }
      setError(data?.error ?? 'Chưa tìm lại được kết quả. Kiểm tra kết nối và thử lại.');
    } catch { setError('Chưa tìm lại được kết quả. Kiểm tra kết nối và thử lại.'); }
    finally { sending.current = false; setBusy(false); }
  }

  if (!request && !error) return null;
  return <section aria-label="Khôi phục đặt sân" className="mx-auto mt-6 max-w-7xl px-5 lg:px-16">
    <div className="rounded-card border border-strong bg-card p-5">
      <h2 className="font-semibold text-pitch">{request ? 'Lần đặt vừa rồi chưa rõ kết quả' : 'Chưa tiếp tục được lần đặt'}</h2>
      {request && <p className="mt-2 text-sm leading-6 text-ink-secondary">Tiếp tục lần đặt đã gửi. Nếu đã có đơn, bạn sẽ mở lại đúng đơn đó; nếu chưa có, hệ thống sẽ giữ chỗ theo lựa chọn vừa rồi. Đơn cũ giữ nguyên hạn thanh toán.</p>}
      {error && <p role="alert" className="mt-3 text-sm leading-6 text-danger">{error}</p>}
      {request && <button type="button" disabled={busy} onClick={recover} className="pf-action mt-3 min-h-11 rounded-control bg-pitch px-4 py-2 text-sm font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang khôi phục…' : 'Tiếp tục lần đặt này'}</button>}
    </div>
  </section>;
}
