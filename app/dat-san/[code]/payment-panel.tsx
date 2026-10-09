'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Copy, LoaderCircle, MapPin, QrCode, RefreshCw, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { CancelBookingButton } from '@/components/cancel-booking-button';
import { BrandMark } from '@/components/brand-mark';
import { createClient, subscribeWithSession } from '@/lib/supabase/client';
import { vietQrUrl } from '@/lib/sepay';
import { countdown, dayLabel, hhmm, vnd } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

type Connection = 'connecting' | 'live' | 'offline' | 'syncing' | 'disconnected' | 'error';

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
  const [connection, setConnection] = useState<Connection | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const checkRef = useRef<() => void>(() => {});
  // Dùng cùng giá trị với HTML server để đồng hồ không gây lỗi hydration.
  const [left, setLeft] = useState(p.initialSeconds);

  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(() => {
      setLeft(Math.floor((new Date(p.expiresAt).getTime() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [p.expiresAt, status]);

  useEffect(() => {
    let active = true;
    let joined = false;
    let revision = 0;
    let request: AbortController | null = null;
    setStatus(p.status);
    setConnection(navigator.onLine ? 'connecting' : 'offline');
    async function reconcile() {
      if (!active || request) return;
      if (!navigator.onLine) { setConnection('offline'); return; }
      const controller = new AbortController();
      const before = revision;
      request = controller;
      setConnection('syncing');
      try {
        const { data, error } = await supabase.from('bookings').select('status').eq('id', p.bookingId).abortSignal(controller.signal).single();
        if (!active || controller.signal.aborted) return;
        if (error || !data) throw new Error('Cannot read booking status');
        // A newer realtime event wins over a read that started before it.
        if (revision === before) setStatus(data.status);
        setLastChecked(new Date().toISOString());
        setConnection(navigator.onLine ? joined ? 'live' : 'disconnected' : 'offline');
      } catch {
        if (active && !controller.signal.aborted && revision === before) setConnection(navigator.onLine ? 'error' : 'offline');
      } finally { if (request === controller) request = null; }
    }
    checkRef.current = () => { void reconcile(); };
    const onOnline = () => { void reconcile(); };
    const onOffline = () => { request?.abort(); request = null; setConnection('offline'); };
    const onVisible = () => { if (document.visibilityState === 'visible') void reconcile(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const channel = supabase
      .channel(`booking:${p.bookingId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${p.bookingId}` },
        payload => {
          if (!active) return;
          revision++;
          setStatus((payload.new as { status: BookingStatus }).status);
          setLastChecked(new Date().toISOString());
          setConnection(navigator.onLine ? 'live' : 'offline');
        });
    const unsubscribe = subscribeWithSession(supabase, channel, state => {
      if (!active) return;
      joined = state === 'SUBSCRIBED';
      if (joined) void reconcile();
      else setConnection(navigator.onLine ? 'disconnected' : 'offline');
    });
    return () => {
      active = false;
      request?.abort();
      checkRef.current = () => {};
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [supabase, p.bookingId, p.status]);

  const paid = status === 'confirmed' || status === 'completed';
  const completed = status === 'completed';
  const fullPayment = p.deposit >= p.total;
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
            <li aria-current={paid ? 'step' : undefined} className="flex items-center gap-2 text-ink-secondary"><span className={`grid size-6 place-items-center rounded-full ${paid ? 'bg-pitch text-white' : 'border border-hairline'}`}>3</span>{completed ? 'Hoàn tất' : 'Ra sân'}</li>
          </ol>
          <Link href="/" className="group inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch transition-colors hover:border-strong hover:bg-free-fill sm:px-4 sm:text-sm"><ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" aria-hidden="true" />Về trang chủ</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-8 pt-5 sm:px-8 sm:pt-10">
        <div className="checkout-enter mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-8">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-secondary"><span className="h-px w-6 bg-success" />Hẹn nhau trên sân</p>
            <h1 className="font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-pitch sm:text-5xl">{completed ? 'Buổi chơi đã hoàn tất.' : paid ? 'Cọc đã nhận. Hẹn trên sân!' : closed ? 'Hẹn bạn ở kèo tiếp theo.' : <>Kèo đã lên. <span className="block sm:inline">Chốt sân thôi.</span></>}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">{completed ? 'Xem lại lịch chơi và thông tin cọc đã nhận cho đơn này.' : paid ? 'Lịch chơi đã được xác nhận. Chỉ còn chờ đến giờ ra sân.' : closed ? 'Xem lại trạng thái đơn đặt sân của bạn bên dưới.' : 'Quét mã, chuyển cọc. Lịch chơi được xác nhận khi tiền vào.'}</p>
          </div>
          {!paid && !closed && <div className="flex items-center gap-3 rounded-2xl border border-peak-line bg-peak-fill px-4 py-3 text-peak-ink">
            <Clock3 size={20} aria-hidden="true" />
            <div className="flex items-center gap-3 sm:block"><p className="text-[10px] font-medium uppercase tracking-wider">Giữ chỗ còn</p><p className="font-display text-2xl font-bold leading-tight tabular-nums" role="timer" aria-label="Thời gian giữ chỗ còn lại">{countdown(left)}</p></div>
          </div>}
        </div>

        <ConnectionNotice state={connection} lastChecked={lastChecked} onCheck={() => checkRef.current()} />
        <noscript><p className="mb-5 rounded-control border border-hairline bg-card p-4 text-sm leading-6 text-ink-secondary">Trang chưa thể tự cập nhật trạng thái. Nếu đã chuyển cọc, giữ biên lai và <a href={`/dat-san/${p.code}`} className="font-semibold text-pitch underline underline-offset-4">tải lại trạng thái đơn</a>.</p></noscript>
        <section aria-label="Tóm tắt lịch chơi" className="checkout-enter mb-5 rounded-card border border-hairline bg-card p-4 lg:hidden">
          <p className="break-words font-display text-xl font-bold text-pitch">{p.venueName}</p><p className="mt-1 text-sm text-ink-secondary">{p.courtName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-pitch"><span className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" /><time dateTime={p.startsAt} className="capitalize">{dayLabel(new Date(p.startsAt))}</time></span><strong className="tabular-nums">{hhmm(p.startsAt)}–{hhmm(p.endsAt)}</strong></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-sm"><span className="text-ink-secondary">{paid ? 'Tiền cọc đã nhận' : closed ? 'Tiền cọc của đơn' : 'Cọc cần chuyển'}</span><strong className="font-display text-xl font-bold tabular-nums text-pitch">{vnd(p.deposit)}</strong></div>
          {fullPayment && <p className="mt-2 text-xs leading-6 text-ink-secondary">{paid ? 'Đã thanh toán đủ tiền sân' : 'Cọc bằng toàn bộ tiền sân'}</p>}
          <details className="group mt-2 border-t border-hairline"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-pitch [&::-webkit-details-marker]:hidden">Thông tin chi tiết<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><dl className="space-y-3 pb-2 text-sm"><div><dt className="text-xs text-ink-secondary">Địa chỉ sân</dt><dd className="mt-1 break-words text-pitch">{p.venueAddress}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-secondary">Tổng tiền sân</dt><dd className="font-semibold tabular-nums">{vnd(p.total)}</dd></div>{!fullPayment && <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-secondary">{completed ? 'Phần thanh toán tại sân' : 'Trả khi đến sân'}</dt><dd className="font-semibold tabular-nums">{vnd(p.total - p.deposit)}</dd></div>}<div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-secondary">Mã đặt sân</dt><dd className="font-mono font-semibold">{p.code}</dd></div></dl></details>
        </section>

        <div className="checkout-enter grid overflow-hidden rounded-3xl border border-hairline bg-card lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[370px_minmax(0,1fr)]">
          <section aria-label="Thông tin sân đã chọn" className="relative order-2 hidden min-w-0 flex-col overflow-hidden bg-pitch text-pitch-ink lg:order-1 lg:flex">
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
                <div className="flex items-center justify-between gap-3"><dt className="text-white/70">{paid ? 'Tiền cọc đã nhận' : 'Thanh toán cọc'}</dt><dd className="font-display text-2xl font-bold tabular-nums">{vnd(p.deposit)}</dd></div>
                {!fullPayment && <div className="flex justify-between gap-3 border-t border-dashed border-white/25 pt-4"><dt className="text-white/70">{completed ? 'Phần thanh toán tại sân' : 'Trả khi đến sân'}</dt><dd className="font-medium tabular-nums">{vnd(p.total - p.deposit)}</dd></div>}
              </dl>
              {fullPayment && <p className="mt-4 border-t border-dashed border-white/25 pt-4 text-sm leading-6 text-white/80">{paid ? 'Đã thanh toán đủ tiền sân' : 'Cọc bằng toàn bộ tiền sân'}</p>}
              <div className="mt-auto pt-8">
                <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-5"><span className="text-[10px] uppercase tracking-widest text-white/60">Mã đặt sân</span><span className="font-mono text-sm tracking-wider">{p.code}</span></div>
                <p className="mt-3 text-xs leading-6 text-white/60">{completed ? 'Giữ mã đơn để tra cứu lại buổi chơi.' : paid ? 'Mang theo mã đơn này khi đến sân nhé.' : 'Sân được xác nhận sau khi nhận đủ tiền cọc.'}</p>
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
              <div key={completed ? 'completed' : paid ? 'paid' : 'closed'} className="checkout-enter flex h-full flex-col items-center justify-center px-6 py-12 text-center sm:px-12 sm:py-16" role="status">
                <div className={`mb-7 grid size-24 place-items-center rounded-full border border-strong bg-free-fill text-success ${paid ? 'checkout-success' : ''}`}>
                  {paid ? <svg viewBox="0 0 48 48" fill="none" className="size-12" aria-hidden="true"><path className="checkout-check" d="m12 25 8 8 17-18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : <Clock3 size={36} aria-hidden="true" />}
                </div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-secondary">{completed ? 'Lịch chơi đã hoàn tất' : paid ? 'Thanh toán hoàn tất' : 'Thông tin đơn đặt'}</p>
                <h2 className="font-display text-3xl font-bold tracking-tight text-pitch sm:text-4xl">{completed ? 'Cảm ơn bạn đã ra sân!' : paid ? 'Đặt cọc thành công!' : status === 'cancelled' ? 'Đơn đã hủy' : status === 'no_show' ? 'Đơn đã kết thúc' : 'Đã hết thời gian giữ chỗ'}</h2>
                <p className="mt-4 max-w-sm text-sm leading-7 text-ink-secondary">{completed ? 'Buổi chơi của đơn này đã kết thúc. Bạn có thể xem lại trong lịch sử đặt sân hoặc chọn một lịch chơi mới.' : paid ? (fullPayment ? 'Bạn đã thanh toán đủ tiền sân. Mang theo mã đơn khi đến sân nhé.' : 'Sân đã được giữ cho bạn. Mang theo mã đơn khi đến và thanh toán phần còn lại trực tiếp với chủ sân.') : 'Vui lòng không chuyển thêm tiền cho đơn này. Nếu đã chuyển khoản, liên hệ hỗ trợ để kiểm tra và xử lý khoản cọc.'}</p>
                <div className="my-7 w-full max-w-sm rounded-xl border border-dashed border-strong bg-free-fill px-5 py-4"><p className="text-xs text-ink-secondary">Mã đặt sân của bạn</p><p className="mt-2 font-mono text-2xl font-semibold tracking-widest text-pitch">{p.code}</p></div>
                <Link href={completed ? '/tim-san' : paid ? '/don-cua-toi' : '/tim-san'} className="group flex min-h-13 w-full max-w-sm items-center justify-center gap-3 rounded-xl bg-pitch px-4 text-sm font-semibold text-pitch-ink transition-colors hover:bg-success">{completed ? 'Đặt lịch chơi mới' : paid ? 'Xem sân đã đặt' : 'Tìm khung giờ khác'}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>
                {completed && <Link href="/don-cua-toi?filter=history" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline underline-offset-4">Xem lịch sử đặt sân</Link>}
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
                    <p data-payment-amount className="mt-2 whitespace-nowrap font-display text-[clamp(2rem,8vw,3rem)] font-extrabold tracking-tight text-pitch sm:text-5xl xl:text-6xl">{vnd(p.deposit)}</p>
                    <p className="mt-2 text-xs text-ink-secondary">{fullPayment ? 'Cọc bằng toàn bộ tiền sân. Nhận đủ cọc, bạn không cần trả thêm tiền sân khi đến chơi.' : 'Phần còn lại trả khi đến sân'}</p>
                  </div>
                  <div className="grid items-start gap-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="text-center">
                      <PaymentQr code={p.code} amount={p.deposit} bank={bank} account={account} />
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
                  <div><p className="text-xs font-semibold">Đang chờ tiền cọc</p><p className="mt-1 text-[11px] leading-6">{connection === 'live' ? 'Chuyển xong, quay lại trang này. Xác nhận sẽ tự hiện khi hệ thống nhận được tiền.' : 'Nếu đã chuyển cọc, giữ lại biên lai và kiểm tra trạng thái đơn khi kết nối hoạt động trở lại.'}</p></div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 text-xs leading-6 text-ink-secondary">
          {!paid && !closed ? <div className="max-w-xl"><p>Về trang chủ vẫn giữ chỗ đến hết thời gian trên. Chưa nhận đủ cọc khi hết hạn, sân sẽ mở lại.</p><div className="mt-1"><CancelBookingButton code={p.code} refundable={false} pending onCancelled={() => setStatus('cancelled')} className="inline-flex min-h-11 items-center" /></div></div> : <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-success" aria-hidden="true" />Giữ mã đơn để tra cứu hoặc liên hệ hỗ trợ.</p>}
          <p className="flex flex-wrap items-center gap-x-2">Cần một tay?<Link href="/lien-he" className="inline-flex min-h-11 items-center gap-1 font-semibold text-pitch underline underline-offset-4">Liên hệ hỗ trợ<ArrowRight size={13} aria-hidden="true" /></Link></p>
        </div>
      </main>
    </div>
  );
}

function ConnectionNotice({ state, lastChecked, onCheck }: { state: Connection | null; lastChecked: string | null; onCheck: () => void }) {
  if (!state) return null;
  const pending = state === 'connecting' || state === 'syncing';
  const titles: Record<Connection, string> = {
    connecting: 'Đang kết nối cập nhật đơn…',
    live: 'Đang theo dõi trạng thái đơn',
    offline: 'Bạn đang mất mạng',
    syncing: 'Đang kiểm tra trạng thái đơn…',
    disconnected: 'Cập nhật tự động đang gián đoạn',
    error: 'Chưa kiểm tra được trạng thái đơn',
  };
  return <div data-checkout-connection={state} className="mb-5 flex flex-col items-stretch justify-between gap-3 rounded-control border border-hairline bg-card px-4 py-3 sm:flex-row sm:items-center">
    <div role="status" className="flex min-w-0 flex-1 items-start gap-2.5 text-pitch">
      {pending ? <LoaderCircle className="pf-spin mt-0.5 size-4 shrink-0" aria-hidden="true" /> : state === 'live' ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <div><p className="text-xs font-semibold">{titles[state]}</p>
        {state === 'offline' ? <p className="mt-1 text-xs leading-6 text-ink-secondary">Trạng thái sẽ được kiểm tra lại khi bạn nối mạng.</p>
          : (state === 'disconnected' || state === 'error') && <p className="mt-1 text-xs leading-6 text-ink-secondary">{lastChecked ? `Lần cập nhật gần nhất lúc ${hhmm(lastChecked)}. ` : ''}Bấm kiểm tra trạng thái để thử lại. Nếu đã chuyển cọc, hãy giữ biên lai và chờ xác nhận.</p>}
      </div>
    </div>
    {state !== 'live' && <button type="button" disabled={pending || state === 'offline'} onClick={onCheck} className="pf-action inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-control border border-hairline px-3 text-xs font-semibold text-pitch disabled:opacity-60 sm:self-auto"><RefreshCw className="size-4" aria-hidden="true" />Kiểm tra trạng thái</button>}
  </div>;
}

function PaymentQr({ code, amount, bank, account }: { code: string; amount: number; bank: string; account: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('ready');
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const src = vietQrUrl(code, amount, bank, account) + (attempt ? `&_retry=${attempt}` : '');
  useEffect(() => {
    const image = imageRef.current;
    if (image) setState(image.complete ? image.naturalWidth ? 'ready' : 'failed' : 'loading');
  }, [attempt]);
  return <div ref={frameRef} role="group" aria-label="Mã QR chuyển khoản" tabIndex={-1} className="checkout-qr relative mx-auto flex aspect-square w-[260px] max-w-full items-center justify-center rounded-2xl border border-strong bg-white p-4" data-payment-qr={state}>
    <span className="checkout-corner absolute -left-px -top-px size-7 rounded-tl-2xl border-l-[3px] border-t-[3px] border-pitch" aria-hidden="true" />
    <span className="checkout-corner absolute -right-px -top-px size-7 rounded-tr-2xl border-r-[3px] border-t-[3px] border-pitch" aria-hidden="true" />
    <span className="checkout-corner absolute -bottom-px -left-px size-7 rounded-bl-2xl border-b-[3px] border-l-[3px] border-pitch" aria-hidden="true" />
    <span className="checkout-corner absolute -bottom-px -right-px size-7 rounded-br-2xl border-b-[3px] border-r-[3px] border-pitch" aria-hidden="true" />
    {state === 'failed' ? <div className="px-2 text-center"><p role="status" className="text-sm leading-6 text-ink-secondary">Chưa tải được mã QR. Bạn vẫn có thể dùng thông tin chuyển khoản trên trang.</p><button type="button" onClick={() => { frameRef.current?.focus(); setState('loading'); setAttempt(value => value + 1); }} className="pf-action mt-4 inline-flex min-h-11 items-center gap-2 rounded-control border border-hairline px-3 text-xs font-semibold text-pitch"><RefreshCw className="size-4" aria-hidden="true" />Tải lại mã QR</button></div> : <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={attempt} ref={imageRef} src={src} alt={`Mã QR chuyển khoản cọc cho đơn ${code}`} width={240} height={240} className="h-auto w-full" onLoad={() => setState('ready')} onError={() => setState('failed')} />
      {state === 'loading' && <span role="status" className="absolute inset-4 flex items-center justify-center gap-2 rounded-control bg-white text-xs text-ink-secondary"><LoaderCircle className="pf-spin size-4" aria-hidden="true" />Đang tải mã QR…</span>}
    </>}
  </div>;
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
