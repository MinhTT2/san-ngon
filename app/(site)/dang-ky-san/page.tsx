import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm } from './register-form';
import { OwnerStatusSteps } from './venue-status-steps';
import { ConnectionPanel, type ConnectionSummary } from '@/components/sepay-connection-panel';
import { BrandMark } from '@/components/brand-mark';
import type { OwnerVenue } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Đăng ký chủ sân · Sân Ngon' };

type OwnerProfile = { full_name: string | null; phone: string | null; role: string; owner_application_status: string | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ resubmit?: string; error?: string; connected?: string }> }) {
  const { resubmit, error: callbackError, connected } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile: OwnerProfile | null = null;
  let venues: OwnerVenue[] = [];
  let loadFailed = false;
  if (user) {
    const [{ data, error: profileError }, { data: venueRows, error: venueError }] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, role, owner_application_status').eq('id', user.id).maybeSingle(),
      supabase.from('venues').select('id, slug, name, address, district, phone, status').eq('owner_id', user.id).order('created_at').order('id'),
    ]);
    profile = data as OwnerProfile | null;
    venues = (venueRows ?? []) as OwnerVenue[];
    loadFailed = Boolean(profileError || venueError);
  }
  const approved = profile?.owner_application_status === 'active';
  let connection: ConnectionSummary | null = null;
  if (profile?.owner_application_status === 'pending' || approved) {
    const result = await supabase.rpc('get_my_sepay_connection');
    connection = result.data as ConnectionSummary | null;
    loadFailed ||= Boolean(result.error);
  }

  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-16 lg:py-12"><div className="mb-8 flex items-center gap-2 text-xs text-ink-secondary"><Link href="/" className="hover:text-pitch">Trang chủ</Link><span aria-hidden="true">/</span><span>Dành cho chủ sân</span></div>{loadFailed ? <section className="rounded-card border border-hairline bg-card p-8"><h1 className="font-display text-2xl font-bold text-pitch">Chưa tải được hồ sơ của bạn</h1><p className="mt-3 text-ink-secondary">Hãy tải lại trang để kiểm tra lại trạng thái.</p></section> : !user ? <LoginCard /> : profile?.owner_application_status === 'pending' || (approved && (connection?.status !== 'ready' || Boolean(callbackError) || connected === '1')) ? <RegistrationPayment connection={connection} approved={approved} callbackError={callbackError} justConnected={connected === '1'} /> : !approved ? <OwnerStatusOrForm profile={profile} resubmit={resubmit === '1'} /> : <ApprovedOwner venues={venues} />}</main>;
}

function OwnerStatusOrForm({ profile, resubmit }: { profile: OwnerProfile | null; resubmit: boolean }) {
  if (profile?.owner_application_status === 'rejected' && !resubmit) return <OwnerStatusSteps status="rejected" />;
  return <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10"><div><header className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Đồng hành cùng Sân Ngon</p><h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-pitch sm:text-5xl">Trở thành chủ sân.</h1><p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Hoàn tất thông tin đại diện, giấy tờ và tài khoản nhận cọc ngay tại đây. Khi được duyệt, bạn bắt đầu tạo cụm sân.</p></header><RegisterForm defaultName={profile?.full_name} defaultPhone={profile?.phone} /></div><aside className="rounded-card bg-pitch p-7 text-pitch-ink"><span className="text-xs font-medium uppercase tracking-[0.16em] text-free-line">Quy trình đơn giản</span><h2 className="mt-4 font-display text-2xl font-bold">Duyệt tài khoản trước, đăng sân sau.</h2><p className="mt-3 text-sm leading-6 text-pitch-ink/75">Bạn kết nối SePay ở bước cuối để chọn tài khoản nhận cọc. Sân Ngon xét duyệt hồ sơ trước khi bạn tạo cụm sân và nhận đơn.</p></aside></div>;
}

function RegistrationPayment({ connection, approved, callbackError, justConnected }: {
  connection: ConnectionSummary | null; approved: boolean; callbackError?: string; justConnected: boolean;
}) {
  const ready = connection?.status === 'ready';
  return <div className="mx-auto max-w-4xl">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Đăng ký chủ sân · Bước 3/3</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-pitch">{ready ? 'Đã hoàn tất đăng ký.' : 'Kết nối tài khoản nhận cọc.'}</h1>
      <p className="mt-4 text-sm leading-7 text-ink-secondary">{ready ? approved ? 'Hồ sơ đã được duyệt và tài khoản nhận cọc đã sẵn sàng.' : 'Hồ sơ và tài khoản nhận cọc đã được lưu. Sân Ngon sẽ thông báo khi xét duyệt xong.' : 'Thông tin và giấy tờ của bạn đã được lưu. Kết nối SePay, chọn tài khoản ngân hàng để hoàn tất đăng ký.'}</p>
    </header>
    <ol aria-label="Tiến độ đăng ký" className="mt-6 grid grid-cols-3 gap-3 text-xs font-semibold text-pitch">
      {['Người đại diện', 'Giấy tờ kinh doanh', 'Tài khoản nhận cọc'].map((label, index) => <li key={label} className="flex items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-pitch">{index < 2 || ready ? '✓' : '3'}</span><span>{label}</span></li>)}
    </ol>
    <ConnectionPanel connection={connection} callbackError={callbackError} justConnected={justConnected} returnTo="/dang-ky-san" awaitingApproval={!approved} />
    <p role="status" className="mt-6 text-sm leading-7 text-ink-secondary">{approved ? ready ? 'Bạn có thể tiếp tục quản lý cụm sân.' : 'Hồ sơ của bạn đã được duyệt. Hoàn tất kết nối để tiếp tục.' : ready ? 'Hồ sơ đang chờ duyệt. Bạn chưa thể tạo sân hoặc nhận đơn trong thời gian này.' : 'Bạn có thể quay lại trang này để tiếp tục. Hồ sơ cần có tài khoản nhận cọc trước khi được duyệt.'}</p>
    <Link href={approved && ready ? "/chu-san/quan-ly" : "/thong-bao"} className="mt-4 inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">{approved && ready ? "Quản lý cụm sân" : "Xem thông báo"}</Link>
  </div>;
}

function ApprovedOwner({ venues }: { venues: OwnerVenue[] }) {
  return <><header className="mb-8 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Dành cho chủ sân</p><h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-pitch sm:text-5xl">Tài khoản chủ sân đã được duyệt.</h1><p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Tạo cụm sân, thêm sân con và quản lý lịch đặt từ trang quản lý.</p></header><section className="max-w-3xl rounded-card border border-hairline bg-card p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-bold text-pitch">Các cụm sân của bạn</h2><p className="mt-2 text-sm text-ink-secondary">{venues.length ? 'Chọn một cụm sân để xem lịch.' : 'Bạn chưa tạo cụm sân nào.'}</p></div><Link href="/chu-san/quan-ly" className="inline-flex min-h-12 items-center rounded-control bg-pitch px-5 font-semibold text-pitch-ink">+ Tạo cụm sân</Link><Link href="/chu-san/thanh-toan" className="inline-flex min-h-12 items-center rounded-control border border-hairline px-5 font-semibold text-pitch">Kết nối tài khoản nhận cọc</Link></div>{venues.length > 0 && <ul className="mt-6 divide-y divide-hairline border-t border-hairline">{venues.map((venue) => <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-pitch">{venue.name}</p><p className="mt-1 text-sm text-ink-secondary">{venue.address} · {venue.district}</p></div><Link href={`/san/${venue.slug}`} className="text-sm font-semibold text-pitch underline">Xem trang sân</Link></li>)}</ul>}</section></>;
}

function LoginCard() { return <section className="max-w-2xl rounded-card border border-hairline bg-card p-6 sm:p-10"><BrandMark size={44} /><h1 className="mt-6 font-display text-3xl font-bold text-pitch">Đăng ký làm chủ sân</h1><p className="mt-3 text-sm leading-7 text-ink-secondary">Đăng nhập để gửi hồ sơ xác minh. Sau khi được duyệt, bạn sẽ tạo cụm sân trong trang quản lý.</p><Link href="/dang-nhap?next=/dang-ky-san" className="mt-7 inline-flex min-h-13 items-center rounded-control bg-pitch px-6 font-semibold text-pitch-ink">Đăng nhập để bắt đầu <span aria-hidden="true" className="ml-4">→</span></Link></section>; }
