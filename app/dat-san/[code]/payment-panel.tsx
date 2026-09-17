'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { vietQrUrl } from '@/lib/sepay';
import { countdown, hhmm, vnd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

/**
 * Chờ tiền vào. Không polling: đăng ký realtime trên chính dòng đơn này,
 * webhook đổi trạng thái là màn hình tự nhảy.
 */
export function PaymentPanel(p: {
  bookingId: string; code: string; status: BookingStatus;
  startsAt: string; endsAt: string; expiresAt: string;
  total: number; deposit: number;
  courtName: string; venueName: string; venueAddress: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<BookingStatus>(p.status);
  const [left, setLeft] = useState(() =>
    Math.floor((new Date(p.expiresAt).getTime() - Date.now()) / 1000)
  );

  useEffect(() => {
    const t = setInterval(() => {
      setLeft(Math.floor((new Date(p.expiresAt).getTime() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [p.expiresAt]);

  useEffect(() => {
    const channel = supabase
      .channel(`booking:${p.bookingId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${p.bookingId}` },
        (payload) => setStatus((payload.new as { status: BookingStatus }).status))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, p.bookingId]);

  if (status === 'confirmed' || status === 'completed') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 rounded-card bg-free-fill p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl text-pitch-ink">✓</span>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-pitch">Đã giữ sân cho bạn</h1>
          <p className="text-sm text-pitch">Chủ sân đã nhận được đơn này.</p>
        </div>
        <Detail {...p} />
        <Link href="/don-cua-toi" className="flex h-13 items-center justify-center rounded-control bg-pitch font-semibold text-pitch-ink">
          Xem đơn của tôi
        </Link>
      </div>
    );
  }

  if (status === 'cancelled' || left <= 0) {
    return (
      <div className="flex flex-col gap-4 rounded-card border border-hairline p-6 text-center">
        <h1 className="font-display text-xl font-bold">Đơn đã hết hạn giữ chỗ</h1>
        <p className="text-sm text-ink-secondary">
          Khung giờ đã mở lại cho người khác. Nếu bạn đã chuyển khoản, liên hệ chủ sân để được hoàn.
        </p>
        <Link href="/" className="flex h-13 items-center justify-center rounded-control bg-pitch font-semibold text-pitch-ink">
          Chọn sân khác
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
      <div className="flex flex-grow flex-col gap-4 md:pt-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">Chuyển khoản để giữ sân</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          Quét mã bằng app ngân hàng, hoặc chuyển tay theo thông tin bên cạnh. Giữ nguyên nội dung
          chuyển khoản — đó là cách hệ thống nhận ra đơn của bạn.
        </p>
        <dl className="flex flex-col gap-2.5 rounded-card border border-hairline bg-card p-5 text-sm">
          <Row label="Sân" value={`${p.venueName} — ${p.courtName}`} />
          <Row label="Giờ" value={`${hhmm(p.startsAt)} – ${hhmm(p.endsAt)}`} />
          <Row label="Địa chỉ" value={p.venueAddress} />
          <Row label="Tổng tiền sân" value={vnd(p.total)} />
          <Row label="Trả tại sân" value={vnd(p.total - p.deposit)} />
        </dl>
        <div className="flex items-center gap-2 self-start rounded-control bg-sunk px-4 py-2.5 text-sm">
          Giữ sân còn <strong className="tabular-nums">{countdown(left)}</strong>
        </div>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          Chuyển xong đợi vài giây, trang này tự chuyển sang Đã xác nhận. Không cần bấm gì thêm.
        </p>
      </div>

    <div className="flex w-full flex-none flex-col items-center gap-5 md:w-96">
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-4xl font-extrabold tracking-tight text-pitch">{vnd(p.deposit)}</span>
        <span className="text-sm text-ink-secondary">
          Cọc cho {p.courtName}, {hhmm(p.startsAt)}–{hhmm(p.endsAt)}
        </span>
      </div>

      <div className="flex w-full flex-col items-center gap-4 rounded-card border border-strong bg-card p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={vietQrUrl(p.code, p.deposit)}
          alt="Mã QR VietQR, quét bằng app ngân hàng"
          width={220}
          height={220}
        />

        <dl className="w-full text-sm">
          <Row label="Ngân hàng" value={process.env.NEXT_PUBLIC_SEPAY_BANK ?? ''} />
          <Row label="Số tài khoản" value={process.env.NEXT_PUBLIC_SEPAY_ACCOUNT ?? ''} />
          <Row label="Chủ tài khoản" value={process.env.NEXT_PUBLIC_SEPAY_ACCOUNT_NAME ?? ''} />
        </dl>

        <div className="w-full rounded-control border border-peak-line bg-peak-fill p-3.5">
          <p className="text-xs text-peak-ink">Nội dung chuyển khoản — giữ nguyên</p>
          <p className="font-display text-xl font-bold tracking-wider">{p.code}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-control bg-sunk px-4 py-2.5 text-sm md:hidden">
        Giữ sân còn <strong className="tabular-nums">{countdown(left)}</strong>
      </div>
    </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Detail(p: { code: string; venueName: string; courtName: string; venueAddress: string; startsAt: string; endsAt: string; total: number; deposit: number }) {
  return (
    <dl className="flex flex-col gap-2.5 rounded-card border border-hairline bg-card p-5 text-sm">
      <Row label="Mã đơn" value={p.code} />
      <Row label="Sân" value={`${p.venueName} — ${p.courtName}`} />
      <Row label="Giờ" value={`${hhmm(p.startsAt)} – ${hhmm(p.endsAt)}`} />
      <Row label="Địa chỉ" value={p.venueAddress} />
      <Row label="Đã cọc" value={vnd(p.deposit)} />
      <Row label="Trả tại sân" value={vnd(p.total - p.deposit)} />
    </dl>
  );
}
