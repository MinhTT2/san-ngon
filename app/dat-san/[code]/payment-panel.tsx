'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, CheckCheck, Clock3, Copy, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { createClient } from '@/lib/supabase/client';
import { vietQrUrl } from '@/lib/sepay';
import { countdown, dayLabel, hhmm, vnd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

/** Chỉ nghe trạng thái của đơn này qua realtime, không polling. */
export function PaymentPanel(p: {
  bookingId: string; code: string; status: BookingStatus;
  startsAt: string; endsAt: string; expiresAt: string;
  total: number; deposit: number;
  courtName: string; venueName: string; venueAddress: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<BookingStatus>(p.status);
  const [qrFailed, setQrFailed] = useState(false);
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

  const paid = status === 'confirmed' || status === 'completed';
  const closed = status === 'cancelled' || status === 'no_show' || left <= 0;
  const account = process.env.NEXT_PUBLIC_SEPAY_ACCOUNT ?? '';
  const bank = process.env.NEXT_PUBLIC_SEPAY_BANK ?? '';
  const accountName = process.env.NEXT_PUBLIC_SEPAY_ACCOUNT_NAME ?? '';
  const paymentReady = Boolean(bank && accountName && account && !/^0+$/.test(account));

  return (
    <div>
      <div className="mb-8 flex items-center gap-2.5 sm:mb-12">
        <BrandMark size={32} />
        <span className="font-display text-xl font-extrabold tracking-tight text-pitch">Sân Ngon<span className="text-success">.</span></span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-secondary"><ShieldCheck size={15} aria-hidden="true" /> Đặt sân trực tuyến</span>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <section className="contents lg:block">
          <div className="order-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">{paid ? 'Đặt sân thành công' : closed ? 'Thông tin đơn đặt' : 'Bước cuối · Thanh toán cọc'}</p>
            <h1 className="max-w-md font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-pitch sm:text-5xl">
              {paid ? 'Sân đã sẵn sàng cho bạn.' : closed ? 'Hẹn bạn ở kèo tiếp theo.' : <>Chốt sân.<br />Sẵn sàng ra sân.</>}
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-ink-secondary">
              {paid ? 'Đã nhận tiền cọc và gửi đơn đến chủ sân. Bạn có thể xem lại lịch hẹn bên dưới.' : closed ? 'Kiểm tra trạng thái đơn trước khi thực hiện chuyển khoản.' : 'Chỉ còn một bước chuyển cọc. Lịch hẹn của bạn sẽ được xác nhận ngay khi tiền vào.'}
            </p>
          </div>

          <section aria-label="Thông tin sân đã chọn" className="order-3 overflow-hidden rounded-2xl bg-pitch text-pitch-ink lg:mt-8">
            <div className="border-b border-white/15 p-6 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3 text-xs text-white/70"><span>SÂN CỦA BẠN</span><span className="font-mono tracking-wider">{p.code}</span></div>
              <h2 className="font-display text-2xl font-bold tracking-tight">{p.venueName}</h2>
              <p className="mt-2 text-sm text-white/80">{p.courtName}</p>
              <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-white/70"><MapPin size={15} className="mt-1 shrink-0" aria-hidden="true" />{p.venueAddress}</p>
              <div className="mt-6 rounded-control border border-white/20 p-4">
                <p className="text-xs capitalize text-white/75">{dayLabel(new Date(p.startsAt))}</p>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{hhmm(p.startsAt)} <span className="px-1 text-white/40">—</span> {hhmm(p.endsAt)}</p>
              </div>
            </div>
            <dl className="space-y-3 p-6 text-sm sm:p-7">
              <div className="flex justify-between gap-3"><dt className="text-white/70">Tổng tiền sân</dt><dd className="font-semibold tabular-nums">{vnd(p.total)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-white/70">{paid ? 'Đã thanh toán cọc' : 'Tiền cọc'} </dt><dd className="font-semibold tabular-nums">{vnd(p.deposit)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-white/15 pt-3"><dt className="text-white/70">Trả khi đến sân</dt><dd className="font-semibold tabular-nums">{vnd(p.total - p.deposit)}</dd></div>
            </dl>
          </section>
        </section>

        <section aria-label="Thanh toán đơn đặt sân" className="order-2 overflow-hidden rounded-2xl border border-hairline bg-card">
          {!paid && !closed && !paymentReady ? (
            <div className="p-7 sm:p-10" role="status">
              <h2 className="font-display text-2xl font-bold text-pitch">Chưa thể chuyển khoản</h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">Thông tin nhận cọc đang được cập nhật. Vui lòng liên hệ hỗ trợ trước khi chuyển tiền.</p>
              <Link href="/lien-he" className="mt-6 inline-flex h-12 items-center justify-center rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Liên hệ hỗ trợ</Link>
            </div>
          ) : paid || closed ? (
            <div className="flex flex-col items-center p-7 text-center sm:p-10" role="status">
              <div className="mb-6 grid size-16 place-items-center rounded-full bg-free-fill text-pitch">{paid ? <CheckCheck size={30} aria-hidden="true" /> : <Clock3 size={28} aria-hidden="true" />}</div>
              <h2 className="font-display text-2xl font-bold text-pitch">{paid ? 'Đã giữ sân cho bạn' : status === 'cancelled' ? 'Đơn đã hủy' : status === 'no_show' ? 'Đơn đã kết thúc' : 'Đã hết thời gian giữ chỗ'}</h2>
              <p className="mt-3 max-w-sm text-sm leading-7 text-ink-secondary">{paid ? 'Mang theo mã đơn khi đến sân. Phần tiền còn lại thanh toán trực tiếp với chủ sân.' : 'Vui lòng không chuyển thêm tiền cho đơn này. Nếu đã chuyển khoản, liên hệ hỗ trợ để kiểm tra và xử lý khoản cọc.'}</p>
              <p className="my-7 rounded-control bg-sunk px-5 py-3 font-mono text-lg font-semibold tracking-wider text-pitch">{p.code}</p>
              <Link href={paid ? '/don-cua-toi' : '/tim-san'} className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-pitch text-sm font-semibold text-pitch-ink">{paid ? 'Xem đơn của tôi' : 'Tìm khung giờ khác'}<ArrowRight size={17} aria-hidden="true" /></Link>
              {!paid && <Link href="/lien-he" className="mt-5 text-sm font-semibold text-pitch underline underline-offset-4">Liên hệ hỗ trợ</Link>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-7">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-pitch"><QrCode size={18} aria-hidden="true" /> Chuyển khoản giữ sân</h2>
                <div className="flex items-center gap-2 rounded-pill border border-peak-line bg-peak-fill px-3 py-1.5 text-xs text-peak-ink"><Clock3 size={14} aria-hidden="true" /><span>Giữ chỗ <strong className="ml-1 text-sm tabular-nums" role="timer" aria-label="Thời gian giữ chỗ còn lại">{countdown(left)}</strong></span></div>
              </div>

              <div className="px-5 py-6 sm:px-7 sm:py-7">
                <div className="text-center">
                  <p className="text-xs font-medium text-ink-secondary">Số tiền cần chuyển</p>
                  <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-pitch sm:text-5xl">{vnd(p.deposit)}</p>
                  <div className="mx-auto my-5 flex aspect-square w-60 max-w-full items-center justify-center rounded-xl border border-hairline bg-white p-3 sm:w-64">
                    {qrFailed || !account || !bank ? <p className="px-4 text-sm leading-6 text-ink-secondary">Không tải được mã QR. Bạn có thể chuyển khoản theo thông tin bên dưới.</p> : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vietQrUrl(p.code, p.deposit)} alt={`Mã QR chuyển khoản cọc cho đơn ${p.code}`} width={240} height={240} className="h-auto w-full" onError={() => setQrFailed(true)} />
                    )}
                  </div>
                  <p className="text-xs leading-6 text-ink-secondary">Mở app ngân hàng → Quét QR → Kiểm tra và chuyển tiền</p>
                </div>

                <div className="my-6 flex items-center gap-3 text-[11px] text-ink-secondary"><span className="h-px flex-1 bg-hairline" />HOẶC CHUYỂN KHOẢN THỦ CÔNG<span className="h-px flex-1 bg-hairline" /></div>
                <dl className="divide-y divide-hairline text-sm">
                  <TransferRow label="Ngân hàng" value={bank} />
                  <TransferRow label="Chủ tài khoản" value={accountName} />
                  <TransferRow label="Số tài khoản" value={account} copy={account} />
                  <TransferRow label="Số tiền" value={vnd(p.deposit)} copy={String(p.deposit)} />
                </dl>
                <div className="mt-4 rounded-control border border-strong bg-free-fill px-4 py-3">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-ink-secondary">Nội dung chuyển khoản</p><p className="mt-1 font-mono text-xl font-bold tracking-wider text-pitch">{p.code}</p></div><CopyButton value={p.code} label="nội dung chuyển khoản" /></div>
                  <p className="mt-2 text-xs leading-5 text-ink-secondary">Giữ nguyên mã này để tiền cọc được ghi nhận đúng đơn.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-hairline bg-sunk/50 px-5 py-4 sm:px-7" role="status">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-peak-ink" aria-hidden="true" />
                <div><p className="text-sm font-semibold text-pitch">Đang chờ tiền cọc</p><p className="mt-1 text-xs leading-6 text-ink-secondary">Chuyển xong, giữ trang này mở. Hệ thống sẽ tự xác nhận khi nhận được tiền.</p></div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TransferRow({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 py-2"><dt className="shrink-0 text-xs text-ink-secondary">{label}</dt><dd className="flex min-w-0 items-center gap-2 text-right"><span className="break-words font-semibold tabular-nums">{value || 'Chưa cấu hình'}</span>{copy && <CopyButton value={copy} label={label.toLowerCase()} />}</dd></div>;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback('Đã sao chép');
    } catch {
      setFeedback('Không sao chép được. Hãy chọn và sao chép nội dung.');
    }
  }

  return <span className="relative shrink-0"><button type="button" onClick={copy} aria-label={`Sao chép ${label}`} title={`Sao chép ${label}`} className="grid size-10 place-items-center rounded-control border border-hairline bg-card text-pitch transition-colors hover:border-pitch focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch">{feedback === 'Đã sao chép' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button><span role="status" className={feedback ? 'absolute right-0 top-full z-10 mt-1 w-max max-w-52 rounded-control border border-hairline bg-card px-3 py-2 text-xs text-pitch' : 'sr-only'}>{feedback}</span></span>;
}
