export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { TournamentReviewRegistration } from '@/components/tournament-review-registration';
import { TournamentInfo } from '@/components/tournament-info';
import { TournamentWorkspace, TournamentParticipants } from '@/components/tournament-workspace';
import { TournamentRegistration, TournamentRegistrationForm } from '@/components/tournament-registration';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { registrationStatuses, tournamentStatuses, paymentOutcomes, type Registration } from '@/lib/tournaments';
import { TournamentSettlementPanel } from '@/components/tournament-settlement';
import { ActionForm } from '@/components/action-form';
import { Field, fieldClass } from '@/components/form-field';
import { TournamentRefresh } from '@/components/tournament-refresh';
export const metadata = { title: 'Chi tiết giải đấu' };
const dateTime = (value: string) => `${dayLabel(new Date(value))} · ${hhmm(value)}`;
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  const { data: t, error } = await db.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Chưa tải được giải đấu.'); if (!t) notFound();
  const [{ data: manager, error: managerError }, { data: admin, error: adminError }, { data: approvedCount, error: capacityError }, { data: profile }] = await Promise.all([
    db.rpc('manages_tournament', { p_id: id }), user ? db.rpc('is_admin') : Promise.resolve({ data: false, error: null }),
    db.rpc('get_tournament_capacity', { p_id: id }), user ? db.from('profiles').select('full_name,phone').eq('id',user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (managerError || adminError || capacityError) throw new Error('Chưa tải được quyền quản lý hoặc số suất tham gia.');
  const { data: registrationData, error: registrationError } = user ? await db.rpc('get_tournament_registrations', { p_id: id }) : { data: [], error: null };
  if (registrationError) {
    console.error('get_tournament_registrations', registrationError.code, registrationError.message);
    throw new Error('Chưa tải được danh sách tham gia.');
  }
  const registrations = (registrationData ?? []) as Registration[];
  const own = registrations?.find(r => r.user_id === user?.id);
  const { data: court } = t.court_id ? await db.from('courts').select('name,venues(name,owner_id)').eq('id',t.court_id).returns<{ name: string; venues: { name: string; owner_id: string } }[]>().maybeSingle() : { data: null };
  const { data: courts, error: courtsError } = admin && t.status === 'pending' ? await db.from('courts').select('id,name,venues!inner(name,status)').eq('sport',t.sport).eq('is_active',true).eq('venues.status','active').returns<{ id: string; name: string; venues: { name: string; status: string } }[]>() : { data: [], error: null };
  if (courtsError) throw new Error('Chưa tải được sân để duyệt.');
  const ids = registrations?.map(r => r.id) ?? [];
  const { data: payments, error: paymentsError } = ids.length ? await db.from('tournament_payment_events').select('transaction_key,registration_id,amount,outcome,refund_amount,refunded_amount,refund_status,created_at').in('registration_id',ids).order('created_at', { ascending: false }) : { data: [], error: null };
  if (paymentsError) throw new Error('Chưa tải được giao dịch.');
  const closed = t.status !== 'published' || Date.parse(t.registration_deadline) <= Date.now();
  const canRegisterAgain = !own || ['cancelled','expired','rejected'].includes(own.status);
  const payClosed = !own?.payment_expires_at || Date.parse(own.payment_expires_at) <= Date.now() || t.status !== 'published';
  const started = Date.parse(t.starts_at) <= Date.now();
  const nextStep = own ? own.status === 'pending' ? 'Ban tổ chức đang xem đăng ký. Bạn chưa cần chuyển cọc; kết quả sẽ cập nhật tại đây.'
    : own.status === 'approved' ? own.paid_at || own.deposit_amount === 0 ? 'Bạn đã hoàn tất đăng ký. Xem lại lịch, địa điểm và thể lệ để chuẩn bị ra sân.'
      : payClosed ? 'Đã hết hạn đóng cọc. Liên hệ ban tổ chức để kiểm tra suất tham gia; không chuyển thêm tiền.'
      : `Bạn đã được duyệt. Chuyển đủ cọc trước ${dateTime(own.payment_expires_at!)} để hoàn tất đăng ký.`
    : own.status === 'expired' ? 'Đăng ký đã hết hạn. Suất đã được trả lại; bạn có thể gửi đăng ký mới nếu giải còn nhận người.'
    : own.status === 'rejected' ? 'Đăng ký chưa được chấp nhận. Xem ghi chú của ban tổ chức bên dưới.'
    : 'Đăng ký đã hủy. Nếu đã chuyển tiền, xem mục giao dịch và liên hệ chủ sân để đối soát hoàn cọc.' : '';
  const canJoin = canRegisterAgain && !closed && (approvedCount ?? 0) < t.capacity;
  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const awaitingCount = registrations.filter(r => r.status === 'approved' && !r.paid_at && r.deposit_amount > 0).length;
  const readyCount = registrations.filter(r => r.status === 'approved' && (r.paid_at || r.deposit_amount === 0)).length;
  const refundCount = (payments ?? []).filter(p => p.refund_status === 'needed').length + registrations.filter(r => r.balance_refund_due > 0 && !r.balance_refunded_at).length;
  const registrationForm = <TournamentRegistrationForm tournament={t} signedIn={!!user} profile={profile} again={!!own} />;
  const personalRegistration = own && <TournamentRegistration own={own} nextStep={nextStep} payClosed={payClosed} started={started} canJoin={canJoin} />;
  const rules = <section className="rounded-card border border-hairline bg-card p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-pitch">Thể lệ & thông tin từ ban tổ chức</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-ink-secondary">{t.description}</p>{t.review_note && <p className="mt-4 rounded-control bg-sunk p-4 text-sm">Ghi chú admin: {t.review_note}</p>}</section>;
  const information = <TournamentInfo tournament={t} court={court ? `${court.venues?.name} · ${court.name}` : null} approved={approvedCount ?? 0} />;
  const paymentHistory = <>    {!!payments?.length && <section id="giao-dich" className="scroll-mt-6"><h2 className="font-display text-2xl font-bold text-pitch">Cọc & hoàn tiền</h2><ul className="mt-4 space-y-3">{payments.map(p => { const r = registrations?.find(r => r.id === p.registration_id); return <li key={p.transaction_key} className="rounded-card border border-hairline bg-card p-5 text-sm"><p className="font-semibold">{r?.full_name} · {vnd(p.amount)} · {paymentOutcomes[p.outcome] ?? p.outcome}</p><p className="mt-2 break-all text-xs text-ink-secondary">{dateTime(p.created_at)} · Mã giao dịch: {p.transaction_key.split(':').at(-1)}</p>{p.refund_amount > 0 && <p className="my-3">{p.refund_status === 'done' ? `Đã hoàn ${vnd(p.refunded_amount)}` : `Cần hoàn ${vnd(p.refund_amount-p.refunded_amount)}`}</p>}{p.refund_status === 'needed' && (admin || r?.payment_owner_id === user?.id) && <ActionForm payload={{ action: 'refund', transaction_key: p.transaction_key, expected_amount: p.refund_amount-p.refunded_amount }} label="Đã chuyển tiền hoàn" confirmMessage={`Xác nhận đã hoàn ${vnd(p.refund_amount-p.refunded_amount)} qua ngân hàng? Thao tác này chỉ ghi nhận, không tự chuyển tiền.`} />}</li>; })}</ul></section>}
</>;
  const participantItems = registrations.toSorted((a,b) => Number(b.status === 'pending') - Number(a.status === 'pending')).map(r => ({
    id: r.id, search: `${r.full_name} ${r.team_name} ${r.phone}`, state: r.status === 'pending' ? 'pending' : r.status === 'approved' ? r.paid_at || r.deposit_amount === 0 ? 'ready' : 'awaiting' : 'inactive',
    content: (<article key={r.id} className="rounded-card border border-hairline bg-card p-5"><h3 className="break-words font-display text-lg font-bold text-pitch">{r.full_name}{r.team_name && ` · ${r.team_name}`}</h3><p className="mt-2 text-sm">{r.phone} · {r.address}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{r.note}</p><p className="my-3 text-sm font-semibold text-pitch">{registrationStatuses[r.status]} · {r.paid_at ? `Đã cọc ${vnd(r.deposit_amount)}` : r.deposit_amount === 0 ? 'Không cần cọc' : 'Chưa nhận đủ cọc'}</p>
      {r.status === 'pending' && !closed && <TournamentReviewRegistration id={r.id} />}
      {r.status === 'approved' && t.status === 'published' && Date.parse(t.ends_at) > Date.now() && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm text-ink-secondary">Hủy suất này</summary><ActionForm payload={{ action: 'cancel_registration', id: r.id }} variant="danger" label="Hủy suất tham gia" confirmMessage="Hủy suất này và ghi nhận cần hoàn cọc đã nhận?" /></details>}
      {(admin || r.payment_owner_id === user?.id) && <div className="mt-4 space-y-4 border-t border-hairline pt-4">
        <p className="text-sm text-ink-secondary">Phần lệ phí còn lại: {vnd(r.entry_fee-r.deposit_amount)} · {r.balance_received_at ? 'Đã thu' : r.balance_waived_at ? 'Đã miễn / vắng mặt' : 'Chưa thu'}</p>
        {r.balance_receipt && <p className="break-words text-xs text-ink-secondary">Chứng từ / ghi chú: {r.balance_receipt}</p>}
        {started && r.status === 'approved' && (r.paid_at || r.deposit_amount === 0) && r.entry_fee > r.deposit_amount && !r.balance_received_at && !r.balance_waived_at && <><ActionForm payload={{ action: 'balance', id: r.id, refund: false }} label={`Đã thu thêm ${vnd(r.entry_fee-r.deposit_amount)}`} confirmMessage="Xác nhận chủ sân đã nhận số tiền này? Không ghi lại khoản cọc đã được SePay xác nhận."><Field label="Chứng từ / ghi chú thu tiền"><input className={fieldClass} name="receipt" minLength={3} maxLength={300} required /></Field></ActionForm><details><summary className="min-h-11 text-sm font-semibold text-pitch">Vắng mặt hoặc miễn phần còn lại</summary><ActionForm payload={{ action: 'waive_balance', id: r.id }} label="Ghi nhận không thu thêm" confirmMessage="Xác nhận không thu phần lệ phí còn lại? Khoản cọc đã nhận giữ theo chính sách hủy."><Field label="Lý do miễn / vắng mặt"><input className={fieldClass} name="note" minLength={3} maxLength={300} required /></Field></ActionForm></details></>}
        {r.balance_refund_due > 0 && !r.balance_refunded_at && <ActionForm payload={{ action: 'balance', id: r.id, refund: true }} label={`Đã hoàn lệ phí còn lại ${vnd(r.balance_refund_due)}`} confirmMessage="Chỉ xác nhận sau khi chuyển trả tiền cho người tham gia."><Field label="Chứng từ hoàn tiền"><input className={fieldClass} name="receipt" minLength={3} maxLength={300} required /></Field></ActionForm>}
      </div>}
    </article>),
  }));
  return <main className="mx-auto max-w-7xl px-5 py-6 lg:px-12 lg:py-8">
    <TournamentRefresh id={id} deadlines={[t.registration_deadline,t.payment_deadline,t.starts_at,t.ends_at,...registrations.flatMap(r => r.payment_expires_at ? [r.payment_expires_at] : [])]} />
    <Link href="/giai-dau" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-secondary hover:text-pitch">← Tất cả giải đấu</Link>
    <header className="mb-7 mt-3 border-b border-hairline pb-6"><div className="flex flex-wrap items-center gap-3"><span className="text-xs font-bold uppercase tracking-widest text-pitch">{SPORT_LABELS[t.sport]}</span><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${t.status === 'pending' ? 'border-peak-line bg-peak-fill text-peak-ink' : 'border-strong bg-free-fill text-pitch'}`}>{tournamentStatuses[t.status]}</span></div><h1 className="mt-3 max-w-4xl break-words font-display text-3xl font-extrabold leading-tight tracking-tight text-pitch sm:text-4xl">{t.title}</h1><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-secondary"><p className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 shrink-0" />{dateTime(t.starts_at)}</p><p className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-4 shrink-0" />{t.address}</p></div></header>
    {manager ? <>
      <h2 className="sr-only">Khu vực quản lý giải</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Chờ duyệt',pendingCount],['Chờ đóng cọc',awaitingCount],['Đã có suất',readyCount],['Khoản cần hoàn',refundCount]].map(([label,count]) => <div key={label} className="rounded-card border border-hairline bg-card p-4"><p className="text-xs text-ink-secondary">{label}</p><p className="mt-1 font-display text-3xl font-bold text-pitch">{count}</p></div>)}</div>
      <TournamentWorkspace pending={pendingCount} refunds={refundCount}
        participants={<>
              {admin && t.status === 'pending' && <section id="duyet-giai" className="scroll-mt-28 mt-6 rounded-card border border-hairline bg-card p-6"><h2 className="mb-4 font-display text-xl font-bold text-pitch">Duyệt & bố trí sân</h2><p className="mb-4 text-sm text-ink-secondary">Duyệt sẽ khóa lịch sân trong thời gian giải và cấp quyền quản lý cho người đề xuất. Cọc luôn về chủ sân được chọn.</p>
      <ActionForm payload={{ action: 'review', id }} label="Lưu kết quả duyệt"><Field label="Kết quả"><select className={fieldClass} name="approve"><option value="true">Duyệt và công khai</option><option value="false">Không duyệt</option></select></Field><Field label="Sân tổ chức"><select className={fieldClass} name="court_id" defaultValue={t.court_id ?? ''}><option value="">Chọn sân để duyệt</option>{courts?.map(c => <option key={c.id} value={c.id}>{c.venues?.name} · {c.name}</option>)}</select></Field><Field label="Tiền thuê sân đã thỏa thuận (đ)"><input className={fieldClass} type="number" name="venue_fee" min={0} max={100000000} defaultValue={0} required /></Field><Field label="Tiền thuê khi người tổ chức hủy cả giải (đ)"><input className={fieldClass} type="number" name="cancellation_venue_fee" min={0} max={100000000} defaultValue={0} required /></Field><Field label="Thỏa thuận thu phí và thuê sân"><textarea className={fieldClass} name="terms_note" maxLength={1000} rows={3} placeholder="Ghi số tiền thuê, người tổ chức chịu phần thiếu; chủ sân thu toàn bộ lệ phí. Chốt riêng tiền thuê khi người tổ chức hủy; chủ sân hủy thì không tính tiền thuê. Hai bên quyết toán trong 7 ngày sau giải." /></Field><label className="flex items-start gap-3 rounded-control bg-free-fill p-4 text-sm leading-7"><input className="mt-1.5 size-5 shrink-0 accent-pitch" type="checkbox" name="terms_confirmed" />Chủ sân và người tổ chức đã đồng ý thỏa thuận, cách thu/hoàn và quyết toán. Bắt buộc khi duyệt công khai.</label><Field label="Ghi chú / lý do không duyệt"><textarea className={fieldClass} name="note" maxLength={1000} rows={3} /></Field></ActionForm>
    </section>}

          {!admin && ['pending','rejected'].includes(t.status) && <section className="rounded-card border border-strong bg-free-fill p-6"><h2 className="font-display text-xl font-bold text-pitch">{t.status === 'pending' ? 'Đề xuất của bạn đang chờ duyệt' : 'Đề xuất cần chỉnh sửa'}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{t.review_note || 'Admin sẽ kiểm tra địa điểm và thỏa thuận thuê sân trước khi công khai. Bạn chưa cần duyệt người tham gia.'}</p>    {user && t.manager_id === user.id && ['pending','rejected'].includes(t.status) && <Link href={`/giai-dau/tao?edit=${id}`} className="mt-6 inline-flex min-h-11 items-center rounded-control border border-strong px-5 text-sm font-semibold text-pitch">Chỉnh sửa và gửi lại đề xuất →</Link>}
</section>}
          <section id="nguoi-tham-gia" className="scroll-mt-6"><h2 className="font-display text-2xl font-bold text-pitch">Người tham gia</h2><p className="mt-2 text-sm text-ink-secondary">Duyệt đăng ký để cấp suất và gửi hướng dẫn đóng cọc.</p><TournamentParticipants items={participantItems} /></section>
        </>}
        finance={<>{paymentHistory}{!payments?.length && <p className="rounded-card border border-hairline bg-card p-5 text-sm text-ink-secondary">Chưa có giao dịch cọc. Tiền sẽ hiện ở đây khi người tham gia chuyển khoản.</p>}{user && <TournamentSettlementPanel id={id} userId={user.id} admin={!!admin} />}</>}
        information={<><div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5">{rules}{personalRegistration}{canJoin && <details className="rounded-card border border-hairline bg-card p-5"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-pitch">Tôi cũng muốn đăng ký một suất tham gia</summary>{registrationForm}</details>}</div>{information}</div><details className="border-t border-hairline pt-4"><summary className="min-h-11 cursor-pointer text-sm text-ink-secondary">Tùy chọn quản lý giải</summary>    {user && t.manager_id === user.id && ['pending','rejected'].includes(t.status) && <Link href={`/giai-dau/tao?edit=${id}`} className="mt-6 inline-flex min-h-11 items-center rounded-control border border-strong px-5 text-sm font-semibold text-pitch">Chỉnh sửa và gửi lại đề xuất →</Link>}
    {manager && Date.parse(t.ends_at) > Date.now() && ['pending','published'].includes(t.status) && <section className="mt-8 border-t border-hairline pt-6"><ActionForm payload={{ action: 'cancel', id }} variant="danger" label="Hủy giải đấu" confirmMessage="Hủy giải, trả lịch sân và ghi nhận các khoản cọc cần hoàn?" /></section>}
</details></>}
      />
    </> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="min-w-0 space-y-5">
      {personalRegistration}
      {canJoin ? registrationForm : !own && <section id="dang-ky" className="rounded-card border border-hairline bg-sunk p-6"><h2 className="font-display text-xl font-bold text-pitch">{closed ? 'Giải đã đóng đăng ký' : 'Giải đã đủ suất'}</h2><p className="my-3 text-sm text-ink-secondary">{closed ? 'Hiện không nhận thêm đăng ký cho giải này.' : 'Các suất hiện đã được duyệt. Bạn có thể xem một giải khác.'}</p><Link href="/giai-dau" className="inline-flex min-h-11 items-center font-semibold text-pitch underline">Khám phá giải khác →</Link></section>}
      {paymentHistory}
      {rules}
    </div>{information}</div>}
  </main>;
}
