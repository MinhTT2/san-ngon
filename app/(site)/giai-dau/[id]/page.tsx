export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { tournamentLabel, paymentOutcomes, type Registration } from '@/lib/tournaments';
import { TournamentSettlementPanel } from '@/components/tournament-settlement';
import { TournamentRegistration } from '@/components/tournament-registration';
import { TournamentParticipants } from '@/components/tournament-participants';
import { TournamentReviewForm } from '@/components/tournament-review-form';
import { ActionForm } from '@/components/action-form';
import { Field, fieldClass } from '@/components/form-field';
import { TournamentRefresh } from '@/components/tournament-refresh';

export const metadata = { title: 'Chi tiết giải đấu' };
const dateTime = (value: string) => `${dayLabel(new Date(value))} · ${hhmm(value)}`;
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { view: requestedView } = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const { data: tournament, error } = await db.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Chưa tải được giải đấu.');
  if (!tournament) notFound();
  const [managerResult, adminResult, capacityResult, profileResult] = await Promise.all([
    db.rpc('manages_tournament', { p_id: id }), user ? db.rpc('is_admin') : Promise.resolve({ data: false, error: null }),
    db.rpc('get_tournament_capacity', { p_id: id }), user ? db.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (managerResult.error || adminResult.error || capacityResult.error || profileResult.error) throw new Error('Chưa tải được trạng thái và quyền tham gia giải.');
  const manager = !!managerResult.data;
  const admin = !!adminResult.data;
  const approvedCount = capacityResult.data ?? 0;
  const profile = profileResult.data;
  const view = manager && ['participants', 'payments', 'settlement'].includes(requestedView ?? '') ? requestedView : 'overview';
  const { data: registrationData, error: registrationError } = user ? await db.rpc('get_tournament_registrations', { p_id: id }) : { data: [], error: null };
  if (registrationError) throw new Error('Chưa tải được danh sách tham gia.');
  const registrations = (registrationData ?? []) as Registration[];
  const own = registrations.find(registration => registration.user_id === user?.id);
  const { data: court, error: courtError } = tournament.court_id ? await db.from('courts').select('name,venues(name,slug,owner_id)').eq('id', tournament.court_id).returns<{ name: string; venues: { name: string; slug: string; owner_id: string } }[]>().maybeSingle() : { data: null, error: null };
  if (courtError) throw new Error('Chưa tải được địa điểm giải.');
  const { data: courts, error: courtsError } = admin && tournament.status === 'pending' ? await db.from('courts').select('id,name,venues!inner(name,status)').eq('sport', tournament.sport).eq('is_active', true).eq('venues.status', 'active').returns<{ id: string; name: string; venues: { name: string; status: string } }[]>() : { data: [], error: null };
  if (courtsError) throw new Error('Chưa tải được sân để duyệt.');
  const registrationIds = registrations.map(registration => registration.id);
  const { data: payments, error: paymentsError } = registrationIds.length ? await db.from('tournament_payment_events').select('transaction_key,registration_id,amount,outcome,refund_amount,refunded_amount,refund_status,created_at').in('registration_id', registrationIds).order('created_at', { ascending: false }) : { data: [], error: null };
  if (paymentsError) throw new Error('Chưa tải được giao dịch.');
  const now = Date.now();
  const closed = tournament.status !== 'published' || Date.parse(tournament.registration_deadline) <= now;
  const canRegisterAgain = !own || ['cancelled', 'expired', 'rejected'].includes(own.status);
  const hasSpace = approvedCount < tournament.capacity;
  const canRegister = canRegisterAgain && !closed && hasSpace;
  const started = Date.parse(tournament.starts_at) <= now;
  const canCancel = tournament.status === 'published' && Date.parse(tournament.ends_at) > now;
  const pendingCount = registrations.filter(registration => registration.status === 'pending').length;
  const unpaidCount = registrations.filter(registration => registration.status === 'approved' && !registration.paid_at && registration.deposit_amount > 0).length;
  const refundCount = payments?.filter(payment => payment.refund_status === 'needed').length ?? 0;
  const historyPayments = manager ? payments : payments?.filter(payment => payment.registration_id !== own?.id);
  const registrationForm = <>
    <h2 className="font-display text-2xl font-bold text-pitch">{own ? 'Gửi đăng ký mới' : 'Đăng ký tham gia'}</h2>
    <p className="my-4 text-sm leading-7 text-ink-secondary">Ban tổ chức xét duyệt từng suất. Chưa chuyển tiền khi chưa được duyệt; thông tin liên hệ chỉ được chia sẻ với bạn và bên quản lý giải.</p>
    {user ? <ActionForm payload={{ action: 'register', id }} nested label="Gửi đăng ký" successMessage="Đã gửi đăng ký. Ban tổ chức sẽ xem và duyệt.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên người tham gia / đại diện"><input className={fieldClass} name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? ''} minLength={2} maxLength={100} required /></Field>
        <Field label="Số điện thoại"><input className={fieldClass} name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone ?? ''} maxLength={25} required placeholder="09xxxxxxxx hoặc +84…" /></Field>
        <Field label="Địa chỉ / khu vực"><input className={fieldClass} name="address" minLength={2} maxLength={300} required /></Field>
        <Field label="Tên đội (nếu thi đấu theo đội)"><input className={fieldClass} name="team_name" maxLength={100} /></Field>
      </div>
      <Field label="Trình độ, thành viên và ghi chú"><textarea className={fieldClass} name="note" maxLength={1000} rows={3} /></Field>
      <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" required className="mt-1.5 size-5 shrink-0 accent-pitch" />Tôi đã đọc thể lệ, lệ phí {vnd(tournament.entry_fee)} và chính sách hủy / hoàn cọc của giải.</label>
    </ActionForm> : <Link href={`/dang-nhap?next=${encodeURIComponent(`/giai-dau/${id}#dang-ky`)}`} className="inline-flex min-h-11 items-center gap-2 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Đăng nhập để tham gia<ArrowUpRight size={16} aria-hidden="true" /></Link>}
  </>;
  return <main className="mx-auto max-w-7xl px-5 py-7 lg:px-12 lg:py-10">
    <TournamentRefresh id={id} deadlines={[tournament.registration_deadline, tournament.payment_deadline, tournament.starts_at, tournament.ends_at, ...registrations.flatMap(registration => registration.payment_expires_at ? [registration.payment_expires_at] : [])]} />
    <Link href="/giai-dau" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch"><ArrowLeft size={16} aria-hidden="true" />Giải đấu</Link>
    <header className="py-6">
      <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-bold text-pitch">{SPORT_LABELS[tournament.sport]}</span><span className={`rounded-pill border px-3 py-1 text-xs font-semibold ${tournament.status === 'pending' ? 'border-peak-line bg-peak-fill text-peak-ink' : 'border-hairline bg-sunk text-pitch'}`}>{tournamentLabel(tournament, now)}</span></div>
      <h1 className="mt-4 max-w-4xl break-words font-display text-3xl font-extrabold leading-tight text-pitch sm:text-4xl">{tournament.title}</h1>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-secondary"><p className="flex items-start gap-2"><CalendarDays size={17} aria-hidden="true" className="mt-0.5 shrink-0" />{dateTime(tournament.starts_at)}</p><p className="flex min-w-0 items-start gap-2"><MapPin size={17} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="break-words">{tournament.address}</span></p></div>
    </header>
    {manager && <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hairline py-4 text-sm"><p><strong>{pendingCount}</strong> chờ duyệt · <strong>{unpaidCount}</strong> chờ cọc · <strong>{refundCount}</strong> giao dịch cần hoàn</p><span className="text-xs text-ink-secondary">{tournament.manager_id === court?.venues.owner_id ? 'Chủ sân tự tổ chức' : 'Người tổ chức và chủ sân cùng quản lý'}</span></div>
      <nav aria-label="Quản lý giải đấu" className="mb-6 flex flex-wrap border-b border-hairline">{[['overview', 'Tổng quan'], ['participants', `Người tham gia (${registrations.length})`], ['payments', 'Giao dịch & hoàn tiền'], ['settlement', 'Quyết toán']].map(([key, label]) => <Link key={key} href={key === 'overview' ? `/giai-dau/${id}` : `/giai-dau/${id}?view=${key}`} aria-current={view === key ? 'page' : undefined} className={`inline-flex min-h-12 items-center border-b-2 px-3 text-sm ${view === key ? 'border-pitch font-semibold text-pitch' : 'border-transparent text-ink-secondary hover:text-pitch'}`}>{label}</Link>)}</nav>
    </>}
    {view === 'overview' && <>
      {admin && tournament.status === 'pending' && <section id="duyet-giai" className="mb-6 scroll-mt-28 border-b border-hairline pb-6"><h2 className="mb-3 font-display text-2xl font-bold text-pitch">Duyệt & bố trí sân</h2><p className="mb-5 text-sm leading-7 text-ink-secondary">Chốt thỏa thuận với chủ sân và người tổ chức trước khi công khai. Hệ thống kiểm tra lịch và giữ sân trong toàn bộ thời gian giải; cọc luôn về chủ sân được chọn.</p><TournamentReviewForm id={id} courtId={tournament.court_id} courts={courts ?? []} /></section>}
      {own && <TournamentRegistration registration={own} tournament={tournament} canRegisterAgain={canRegister} now={now} paymentHref={manager ? `/giai-dau/${id}?view=payments` : '#giao-dich'} />}
      <div className="grid items-start gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <section><h2 className="font-display text-2xl font-bold text-pitch">Lịch & địa điểm</h2><dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">{[
            ['Sân tổ chức', court ? `${court.venues.name} · ${court.name}` : 'Admin đang bố trí'], ['Địa điểm', tournament.address],
            ['Bắt đầu', dateTime(tournament.starts_at)], ['Kết thúc', dateTime(tournament.ends_at)],
            ['Hạn nhận / duyệt đăng ký', dateTime(tournament.registration_deadline)], ['Hạn đóng cọc cuối cùng', dateTime(tournament.payment_deadline)],
            ['Thời gian cọc sau duyệt', `${tournament.payment_hold_hours} giờ, không vượt hạn cuối`], ['Quy mô', `${tournament.capacity} suất · ${approvedCount} đã được duyệt`],
          ].map(([label, value]) => <div key={label} className="border-b border-hairline pb-4"><dt className="text-xs text-ink-secondary">{label}</dt><dd className="mt-2 break-words font-semibold leading-6">{value}</dd></div>)}</dl>{court && <Link href={`/san/${court.venues.slug}`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline">Xem sân tổ chức<ArrowUpRight size={16} aria-hidden="true" /></Link>}</section>
          <section className="mt-6"><h2 className="font-display text-2xl font-bold text-pitch">Thông tin & thể lệ</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{tournament.description}</p>{tournament.review_note && <p className="mt-5 border-l-2 border-strong pl-4 text-sm leading-7">Ghi chú admin: {tournament.review_note}</p>}</section>
          <section id="chinh-sach" className="mt-6 scroll-mt-28 border-t border-hairline pt-6"><h2 className="font-display text-xl font-bold text-pitch">Cọc & chính sách hủy</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-ink-secondary"><li>Cọc sau khi được duyệt; SePay xác nhận tự động, tiền về chủ sân.</li><li>{tournament.cancel_window_hours === 24 ? 'Tự hủy trước giờ thi đấu ít nhất 24 giờ: hoàn 100% cọc. Muộn hơn không hoàn.' : 'Giải cũ: tự hủy trước giờ bắt đầu được hoàn 100% cọc.'}</li><li>Ban tổ chức hủy suất hoặc giải: hoàn toàn bộ tiền đã nhận. Chủ sân chuyển tiền hoàn thủ công.</li><li>Phần còn lại nộp tại giải bằng tiền mặt hoặc nội dung chuyển khoản riêng, không dùng lại mã cọc GIAI.</li></ul></section>
        </div>
        <aside className="min-w-0 border-t border-strong pt-5 lg:sticky lg:top-24 lg:border-t-0 lg:border-l lg:pl-6">
          <p className="text-sm text-ink-secondary">Lệ phí mỗi suất</p><p className="mt-2 break-words font-display text-3xl font-bold text-pitch">{tournament.entry_fee ? vnd(tournament.entry_fee) : 'Miễn phí'}</p>
          <dl className="mt-5 space-y-3 border-y border-hairline py-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-secondary">Cọc sau khi duyệt</dt><dd className="font-semibold">{vnd(tournament.deposit_amount)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-secondary">Nộp khi tham gia</dt><dd className="font-semibold">{vnd(tournament.entry_fee - tournament.deposit_amount)}</dd></div></dl>
          <p className="mt-4 flex items-center gap-2 text-sm"><Users size={17} aria-hidden="true" />{['pending', 'rejected'].includes(tournament.status) ? 'Chưa mở đăng ký' : closed ? 'Đã đóng đăng ký' : hasSpace ? `Còn ${tournament.capacity - approvedCount} suất có thể duyệt` : 'Đã đủ suất được duyệt'}</p>
          <p className="mt-3 text-xs leading-6 text-ink-secondary">Gửi đăng ký chưa giữ suất. Suất được giữ sau khi ban tổ chức duyệt và xác nhận sau khi đủ cọc hoặc không cần cọc.</p>
          {!manager && <a href="#dang-ky" className="mt-5 flex min-h-12 items-center justify-center rounded-control bg-pitch px-4 text-center text-sm font-semibold text-pitch-ink">{own ? 'Xem đăng ký của bạn' : canRegister ? 'Đăng ký tham gia' : 'Xem trạng thái đăng ký'}</a>}
          {manager && tournament.status === 'published' && <Link href={`/giai-dau/${id}?view=participants`} className="mt-5 flex min-h-12 items-center justify-center rounded-control bg-pitch px-4 text-center text-sm font-semibold text-pitch-ink">Quản lý người tham gia</Link>}
        </aside>
      </div>
      {canRegister ? <section id={own ? 'dang-ky-lai' : 'dang-ky'} className="mt-2 scroll-mt-28 border-t border-hairline py-6">{manager ? <details><summary className="min-h-11 cursor-pointer text-sm font-semibold text-pitch">Tôi cũng muốn đăng ký một suất tham gia</summary><div className="mt-5">{registrationForm}</div></details> : registrationForm}</section> : !own && !manager ? <p id="dang-ky" className="scroll-mt-28 border-t border-hairline py-6 text-sm text-ink-secondary">{closed ? 'Giải chưa mở hoặc đã đóng đăng ký.' : 'Giải đã đủ suất được duyệt.'} <Link href="/giai-dau" className="font-semibold text-pitch underline">Khám phá giải khác</Link></p> : own && canRegisterAgain && <p className="border-t border-hairline py-5 text-sm text-ink-secondary">{closed ? 'Giải đã đóng đăng ký, không thể gửi đăng ký mới.' : 'Giải đã đủ suất được duyệt, chưa thể đăng ký lại.'}</p>}
      {user && tournament.manager_id === user.id && ['pending', 'rejected'].includes(tournament.status) && <Link href={`/giai-dau/tao?edit=${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-control border border-strong px-5 text-sm font-semibold text-pitch">Chỉnh sửa và gửi lại đề xuất<ArrowUpRight size={16} aria-hidden="true" /></Link>}
    </>}
    {view === 'participants' && user && <TournamentParticipants registrations={registrations} closed={closed} started={started} canCancel={canCancel} userId={user.id} admin={admin} />}
    {(view === 'payments' || (!manager && !!payments?.length)) && <section id="giao-dich" className="scroll-mt-28 py-6"><h2 className="font-display text-2xl font-bold text-pitch">Giao dịch cọc & hoàn tiền</h2><p className="mt-3 text-sm leading-7 text-ink-secondary">Hoàn tiền qua ngân hàng trước khi xác nhận tại đây. Tiền thiếu, thừa, trùng hoặc chuyển muộn vẫn được ghi nhận để đối soát.{!!historyPayments?.length && !manager && ' Danh sách bao gồm các lần đăng ký cũ.'}</p>
      {!!payments?.length ? <ul className="mt-5 space-y-3">{payments.map(payment => {
        const registration = registrations.find(registration => registration.id === payment.registration_id);
        return <li key={payment.transaction_key} className="rounded-card border border-hairline bg-card p-5 text-sm">
          <p className="break-words font-semibold">{registration?.full_name} · {vnd(payment.amount)} · {paymentOutcomes[payment.outcome] ?? payment.outcome}</p>
          <p className="mt-2 break-all text-xs text-ink-secondary">{dateTime(payment.created_at)} · Mã giao dịch: {payment.transaction_key.split(':').at(-1)}</p>
          <p className="mt-2 text-xs text-ink-secondary">Mã đăng ký: {registration?.code}{registration?.id !== own?.id && !manager ? ' · Đăng ký trước' : ''}</p>
          {payment.refund_amount > 0 && <p className="my-3 font-semibold">{payment.refund_status === 'done' ? `Đã hoàn ${vnd(payment.refunded_amount)}` : `Cần hoàn ${vnd(payment.refund_amount - payment.refunded_amount)}`}</p>}
          {payment.refund_status === 'needed' && (admin || registration?.payment_owner_id === user?.id) && <ActionForm payload={{ action: 'refund', transaction_key: payment.transaction_key, expected_amount: payment.refund_amount - payment.refunded_amount }} label="Đã chuyển tiền hoàn" confirmMessage={`Xác nhận đã hoàn ${vnd(payment.refund_amount - payment.refunded_amount)} qua ngân hàng? Thao tác này chỉ ghi nhận, không tự chuyển tiền.`} />}
        </li>;
      })}</ul> : <p className="mt-5 border-y border-hairline py-8 text-sm text-ink-secondary">Chưa có giao dịch cọc được ghi nhận.</p>}
    </section>}
    {view === 'settlement' && user && <TournamentSettlementPanel id={id} userId={user.id} admin={admin} />}
    {manager && view === 'overview' && Date.parse(tournament.ends_at) > now && ['pending', 'published'].includes(tournament.status) && <section className="mt-6 border-t border-hairline pt-6"><details><summary className="min-h-11 cursor-pointer text-sm font-semibold text-danger">Hủy giải đấu</summary><p className="my-3 text-sm leading-7 text-ink-secondary">Trả lịch sân và ghi nhận các khoản cần hoàn. Chủ sân thực hiện hoàn tiền; thỏa thuận tiền thuê khi hủy được giữ nguyên.</p><ActionForm payload={{ action: 'cancel', id }} variant="danger" label="Xác nhận hủy giải" confirmMessage="Hủy giải, trả lịch sân và ghi nhận cần hoàn toàn bộ tiền đã nhận?" /></details></section>}
  </main>;
}
