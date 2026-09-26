'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Copy, MapPin, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import { CancelBookingButton } from '@/components/cancel-booking-button';
import { BrandMark } from '@/components/brand-mark';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
import { vietQrUrl } from '@/lib/sepay';
import { countdown, dayLabel, hhmm, vnd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

/** Chỉ nghe trạng thái của đơn này qua realtime, không polling. */
export function PaymentPanel(p: {
  bookingId: string; code: string; status: BookingStatus;
  startsAt: string; endsAt: string; expiresAt: string; initialSeconds: number;
  total: number; deposit: number;
  courtName: string; venueName: string; venueAddress: string;
  bank: string; account: string; accountName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<BookingStatus>(p.status);
  const [qrFailed, setQrFailed] = useState(false);
  // Dùng cùng giá trị với HTML server để đồng hồ không gây lỗi hydration.
  const [left, setLeft] = useState(p.initialSeconds);

  useEffect(() => {
    const t = setInterval(() => {
      setLeft(Math.floor((new Date(p.expiresAt).getTime() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [p.expiresAt]);

  useEffect(() => { setStatus(p.status); }, [p.status]);

  useEffect(() => {
    let active = true;
    async function reconcile() {
      const { data } = await supabase.from('bookings').select('status').eq('id', p.bookingId).single();
      if (active && data) setStatus(data.status);
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void reconcile(); };
    window.addEventListener('online', reconcile);
    document.addEventListener('visibilitychange', onVisible);
    const channel = supabase
      .channel(`booking:${p.bookingId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${p.bookingId}` },
        (payload) => setStatus((payload.new as { status: BookingStatus }).status));
    const unsubscribe = subscribeWithSession(supabase, channel, state => { if (state === 'SUBSCRIBED') void reconcile(); });
    return () => {
      active = false;
      window.removeEventListener('online', reconcile);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [supabase, p.bookingId]);

  const paid = status === 'confirmed' || status === 'completed';
  const closed = status === 'cancelled' || status === 'no_show' || left <= 0;
  const { account, bank, accountName } = p;
  const paymentReady = Boolean(bank && accountName && /^\d{6,30}$/.test(account) && !/^0+$/.test(account));

  return (
    <div className="checkout min-h-dvh">
      <header className="border-b border-hairline bg-card">
        <nav aria-label="Điều hướng thanh toán" className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Sân Ngon — Trang chủ" className="flex shrink-0 items-center gap-2.5">
            <BrandMark size={34} />
            <span className="font-display text-2xl font-extrabold tracking-tight text-pitch">Sân Ngon<span className="text-success">.</span></span>
          </Link>
          <ol aria-label="Tiến trình đặt sân" className="hidden items-center gap-4 text-xs font-medium md:flex">
            <li className="flex items-center gap-2 text-ink-secondary"><span className="grid size-6 place-items-center rounded-full bg-free-fill text-success"><Check size={13} aria-hidden="true" /></span>Chọn sân</li>
            <li aria-hidden="true" className="h-px w-8 bg-hairline" />
            <li aria-current={!paid ? 'step' : undefined} className="flex items-center gap-2 text-pitch"><span className="grid size-6 place-items-center rounded-full bg-pitch text-white">{paid ? <Check size={13} aria-hidden="true" /> : '2'}</span>Thanh toán cọc</li>
            <li aria-hidden="true" className="h-px w-8 bg-hairline" />
            <li aria-current={paid ? 'step' : undefined} className="flex items-center gap-2 text-ink-secondary"><span className={`grid size-6 place-items-center rounded-full ${paid ? 'bg-pitch text-white' : 'border border-hairline'}`}>3</span>Ra sân</li>
          </ol>
          <Link href="/" className="group inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch transition-colors hover:border-strong hover:bg-free-fill sm:px-4 sm:text-sm"><ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" aria-hidden="true" />Về trang chủ</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-8 pt-5 sm:px-8 sm:pt-10">
        <div className="checkout-enter mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-8">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-secondary"><span className="h-px w-6 bg-success" />Hẹn nhau trên sân</p>
            <h1 className="font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-pitch sm:text-5xl">{paid ? 'Cọc đã nhận. Hẹn trên sân!' : closed ? 'Hẹn bạn ở kèo tiếp theo.' : <>Kèo đã lên. <span className="block sm:inline">Chốt sân thôi.</span></>}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">{paid ? 'Lịch chơi đã được xác nhận. Chỉ còn chờ đến giờ ra sân.' : closed ? 'Xem lại trạng thái đơn đặt sân của bạn bên dưới.' : 'Quét mã, chuyển cọc. Lịch chơi được xác nhận khi tiền vào.'}</p>
          </div>
          {!paid && !closed && <div className="flex items-center gap-3 rounded-2xl border border-peak-line bg-peak-fill px-4 py-3 text-peak-ink">
            <Clock3 size={20} aria-hidden="true" />
            <div className="flex items-center gap-3 sm:block"><p className="text-[10px] font-medium uppercase tracking-wider">Giữ chỗ còn</p><p className="font-display text-2xl font-bold leading-tight tabular-nums" role="timer" aria-label="Thời gian giữ chỗ còn lại">{countdown(left)}</p></div>
          </div>}
        </div>

        <div className="checkout-enter grid overflow-hidden rounded-3xl border border-hairline bg-card lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[370px_minmax(0,1fr)]">
          <section aria-label="Thông tin sân đã chọn" className="relative order-2 flex min-w-0 flex-col overflow-hidden bg-pitch text-pitch-ink lg:order-1">
            <div className="relative overflow-hidden border-b border-white/15 px-6 pb-7 pt-7 sm:px-8">
              <svg viewBox="0 0 240 160" fill="none" aria-hidden="true" className="pointer-events-none absolute -right-16 -top-8 w-64 rotate-[-20deg] text-free-line/15">
                <rect x="15" y="15" width="210" height="130" rx="2" stroke="currentColor" />
                <path d="M120 15v130M15 48h32v64H15m210-64h-32v64h32" stroke="currentColor" /><circle cx="120" cy="80" r="26" stroke="currentColor" />
              </svg>
              <div className="relative">
                <p className="mb-7 inline-flex items-center gap-2 rounded-pill border border-white/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em]"><span className="size-1.5 rounded-full bg-free-line" />Lịch chơi của bạn</p>
                <h2 className="break-words font-display text-3xl font-bold leading-tight tracking-tight">{p.venueName}</h2>
                <p className="mt-2 text-sm text-white/80">{p.courtName}</p>
                <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-white/70"><MapPin size={14} className="mt-1 shrink-0" aria-hidden="true" />{p.venueAddress}</p>
                <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-4">
                  <p className="flex items-center gap-2 text-xs capitalize text-white/80"><CalendarDays size={15} aria-hidden="true" />{dayLabel(new Date(p.startsAt))}</p>
                  <p className="mt-3 font-display text-3xl font-bold tabular-nums">{hhmm(p.startsAt)} <span className="px-1 text-white/40">—</span> {hhmm(p.endsAt)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col px-6 py-6 sm:px-8">
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-white/70">Tổng tiền sân</dt><dd className="font-medium tabular-nums">{vnd(p.total)}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-white/70">{paid ? 'Đã thanh toán cọc' : 'Thanh toán cọc'}</dt><dd className="font-display text-2xl font-bold tabular-nums">{vnd(p.deposit)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-dashed border-white/25 pt-4"><dt className="text-white/70">Trả khi đến sân</dt><dd className="font-medium tabular-nums">{vnd(p.total - p.deposit)}</dd></div>
              </dl>
              <div className="mt-auto pt-8">
                <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-5"><span className="text-[10px] uppercase tracking-widest text-white/60">Mã đặt sân</span><span className="font-mono text-sm tracking-wider">{p.code}</span></div>
                <p className="mt-3 text-xs leading-6 text-white/60">{paid ? 'Mang theo mã đơn này khi đến sân nhé.' : 'Sân được xác nhận sau khi nhận đủ tiền cọc.'}</p>
              </div>
            </div>
          </section>

          <section aria-label="Thanh toán đơn đặt sân" className="order-1 min-w-0 lg:order-2">
            {!paid && !closed && !paymentReady ? (
              <div className="flex min-h-96 flex-col items-center justify-center px-6 py-12 text-center sm:px-10" role="status">
                <div className="mb-6 grid size-16 place-items-center rounded-2xl bg-sunk text-pitch"><QrCode size={28} aria-hidden="true" /></div>
                <h2 className="font-display text-2xl font-bold text-pitch">Chưa thể chuyển khoản</h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-ink-secondary">Thông tin nhận cọc đang được cập nhật. Vui lòng liên hệ hỗ trợ trước khi chuyển tiền.</p>
                <Link href="/lien-he" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-control bg-pitch px-6 text-sm font-semibold text-pitch-ink">Liên hệ hỗ trợ</Link>
              </div>
            ) : paid || closed ? (
              <div key={paid ? 'paid' : 'closed'} className="checkout-enter flex h-full flex-col items-center justify-center px-6 py-12 text-center sm:px-12 sm:py-16" role="status">
                <div className={`mb-7 grid size-24 place-items-center rounded-full border border-strong bg-free-fill text-success ${paid ? 'checkout-success' : ''}`}>
                  {paid ? <svg viewBox="0 0 48 48" fill="none" className="size-12" aria-hidden="true"><path className="checkout-check" d="m12 25 8 8 17-18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : <Clock3 size={36} aria-hidden="true" />}
                </div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-secondary">{paid ? 'Thanh toán hoàn tất' : 'Thông tin đơn đặt'}</p>
                <h2 className="font-display text-3xl font-bold tracking-tight text-pitch sm:text-4xl">{paid ? 'Đặt cọc thành công!' : status === 'cancelled' ? 'Đơn đã hủy' : status === 'no_show' ? 'Đơn đã kết thúc' : 'Đã hết thời gian giữ chỗ'}</h2>
                <p className="mt-4 max-w-sm text-sm leading-7 text-ink-secondary">{paid ? (p.deposit >= p.total ? 'Bạn đã thanh toán đủ tiền sân. Mang theo mã đơn khi đến sân nhé.' : 'Sân đã được giữ cho bạn. Mang theo mã đơn khi đến và thanh toán phần còn lại trực tiếp với chủ sân.') : 'Vui lòng không chuyển thêm tiền cho đơn này. Nếu đã chuyển khoản, liên hệ hỗ trợ để kiểm tra và xử lý khoản cọc.'}</p>
                <div className="my-7 w-full max-w-sm rounded-xl border border-dashed border-strong bg-free-fill px-5 py-4"><p className="text-xs text-ink-secondary">Mã đặt sân của bạn</p><p className="mt-2 font-mono text-2xl font-semibold tracking-widest text-pitch">{p.code}</p></div>
                <Link href={paid ? '/don-cua-toi' : '/tim-san'} className="group flex min-h-13 w-full max-w-sm items-center justify-center gap-3 rounded-xl bg-pitch px-4 text-sm font-semibold text-pitch-ink transition-colors hover:bg-success">{paid ? 'Xem sân đã đặt' : 'Tìm khung giờ khác'}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>
                {!paid && <Link href="/lien-he" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline underline-offset-4">Liên hệ hỗ trợ</Link>}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-5 sm:px-8">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-pitch"><QrCode size={18} aria-hidden="true" />Quét mã để giữ sân</h2>
                  <span className="hidden items-center gap-1.5 text-[11px] text-ink-secondary sm:flex"><ShieldCheck size={15} className="text-success" aria-hidden="true" />Chuyển khoản ngân hàng</span>
                </div>
                <div className="px-6 py-7 sm:px-8">
                  <div className="mb-7 text-center">
                    <p className="text-xs text-ink-secondary">Số tiền cọc cần chuyển</p>
                    <p className="mt-2 font-display text-5xl font-extrabold tracking-tight text-pitch sm:text-6xl">{vnd(p.deposit)}</p>
                    <p className="mt-2 text-xs text-ink-secondary">Phần còn lại trả khi đến sân</p>
                  </div>
                  <div className="grid items-start gap-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="text-center">
                      <div className="checkout-qr relative mx-auto flex aspect-square w-[260px] max-w-full items-center justify-center rounded-2xl border border-strong bg-white p-4">
                        <span className="checkout-corner absolute -left-px -top-px size-7 rounded-tl-2xl border-l-[3px] border-t-[3px] border-pitch" aria-hidden="true" />
                        <span className="checkout-corner absolute -right-px -top-px size-7 rounded-tr-2xl border-r-[3px] border-t-[3px] border-pitch" aria-hidden="true" />
                        <span className="checkout-corner absolute -bottom-px -left-px size-7 rounded-bl-2xl border-b-[3px] border-l-[3px] border-pitch" aria-hidden="true" />
                        <span className="checkout-corner absolute -bottom-px -right-px size-7 rounded-br-2xl border-b-[3px] border-r-[3px] border-pitch" aria-hidden="true" />
                        {qrFailed ? <p className="px-3 text-sm leading-6 text-ink-secondary">Không tải được mã QR. Bạn có thể chuyển khoản theo thông tin bên cạnh hoặc bên dưới.</p> : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vietQrUrl(p.code, p.deposit, bank, account)} alt={`Mã QR chuyển khoản cọc cho đơn ${p.code}`} width={240} height={240} className="h-auto w-full" onError={() => setQrFailed(true)} />
                        )}
                      </div>
                      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-pitch"><Smartphone size={15} aria-hidden="true" />Mở app ngân hàng để quét mã</p>
                      <p className="mx-auto mt-2 max-w-64 text-[11px] leading-5 text-ink-secondary">Dùng điện thoại? Lưu ảnh QR rồi chọn ảnh trong mục quét mã của app ngân hàng.</p>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">Thông tin chuyển khoản</p>
                      <dl className="space-y-3 text-sm">
                        <TransferRow label="Ngân hàng" value={bank} />
                        <TransferRow label="Người nhận" value={accountName} />
                        <TransferRow label="Số tài khoản" value={account} copy={account} />
                        <TransferRow label="Số tiền" value={vnd(p.deposit)} copy={String(p.deposit)} />
                      </dl>
                      <div className="mt-4 rounded-xl border border-strong bg-free-fill p-3.5">
                        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[11px] text-ink-secondary">Nội dung chuyển khoản</p><p className="mt-1 break-all font-mono text-lg font-bold tracking-wider text-pitch">{p.code}</p></div><CopyButton value={p.code} label="nội dung chuyển khoản" /></div>
                        <p className="mt-2 text-[10px] leading-5 text-ink-secondary">Giữ nguyên mã để cọc vào đúng đơn.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mx-6 mb-6 flex items-start gap-3 rounded-xl border border-peak-line bg-peak-fill px-4 py-3.5 text-peak-ink sm:mx-8" role="status">
                  <span className="checkout-wait mt-1.5 size-2 shrink-0 rounded-full bg-peak-ink" aria-hidden="true" />
                  <div><p className="text-xs font-semibold">Đang chờ tiền cọc</p><p className="mt-1 text-[11px] leading-6">Chuyển xong, quay lại trang này. Xác nhận sẽ tự hiện khi hệ thống nhận được tiền.</p></div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 text-xs leading-6 text-ink-secondary">
          {!paid && !closed ? <div className="max-w-xl"><p>Về trang chủ vẫn giữ chỗ đến hết thời gian trên. Chưa nhận đủ cọc khi hết hạn, sân sẽ mở lại.</p><div className="mt-1"><CancelBookingButton code={p.code} refundable={false} pending onCancelled={() => setStatus('cancelled')} className="inline-flex min-h-11 items-center" /></div></div> : <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-success" aria-hidden="true" />Thông tin đơn được cập nhật tự động.</p>}
          <p className="flex flex-wrap items-center gap-x-2">Cần một tay?<Link href="/lien-he" className="inline-flex min-h-11 items-center gap-1 font-semibold text-pitch underline underline-offset-4">Liên hệ hỗ trợ<ArrowRight size={13} aria-hidden="true" /></Link></p>
        </div>
      </main>
    </div>
  );
}

function TransferRow({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return <div className="relative min-h-10 pr-12"><dt className="text-[11px] text-ink-secondary">{label}</dt><dd className="mt-0.5 break-all text-sm font-semibold text-pitch tabular-nums">{value || 'Chưa cấu hình'}{copy && <span className="absolute right-0 top-0"><CopyButton value={copy} label={label.toLowerCase()} /></span>}</dd></div>;
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

  return <span className="relative shrink-0"><button type="button" onClick={copy} aria-label={`Sao chép ${label}`} title={`Sao chép ${label}`} className="grid size-11 place-items-center rounded-control border border-hairline bg-card text-pitch transition-colors hover:border-pitch hover:bg-free-fill active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch">{feedback === 'Đã sao chép' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button><span role="status" className={feedback ? 'absolute right-0 top-full z-10 mt-1 w-max max-w-52 rounded-control border border-hairline bg-card px-3 py-2 text-xs text-pitch' : 'sr-only'}>{feedback}</span></span>;
}
