import Link from 'next/link';
import { ArrowUpRight, Building2, ShieldCheck, Users } from 'lucide-react';
import { DashboardPageHeader, DashboardLink } from '@/components/dashboard-page-header';
import { DashboardRecords } from '@/components/dashboard-records';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminVenueAction } from '@/components/admin-venue-action';
import { AdminOwnerAction } from '@/components/admin-owner-action';
import { VENUE_STATUS_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import type { BookingStatus, VenueStatus } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';
import { AdminStatsPanel, PeriodLinks } from '@/components/stats-panels';
import { parseAdminStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản trị · Sân Ngon' };

type View = 'overview' | 'owners' | 'venues' | 'bookings' | 'users';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string; period?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

  const params = await searchParams;
  const view = parseView(params.view);
  const period = params.period === '7' || params.period === '90' ? Number(params.period) : 30;
  const statsTo = new Date();
  const statsFrom = new Date();
  statsFrom.setDate(statsFrom.getDate() - period + 1);
  const [{ data: venues, error: venuesError }, { data: ownerProfiles }, { data: statsData }] = await Promise.all([
    supabase.from('venues').select('id, name, slug, district, status, owner_id, created_at, phone, business_license_path').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, phone, role, owner_application_status, business_license_path, business_license_name, payout_bank, payout_account, created_at'),
    supabase.rpc('get_admin_stats', { p_from: ymd(statsFrom), p_to: ymd(statsTo) }),
  ]);
  if (venuesError) throw new Error('Không tải được hồ sơ sân. Vui lòng thử lại.');

  const pendingVenues = (venues ?? []).filter((venue) => venue.status === 'pending');
  const pendingOwners = (ownerProfiles ?? []).filter((profile) => profile.owner_application_status === 'pending');
  const activeVenues = (venues ?? []).filter((venue) => venue.status === 'active');
  const profileById = new Map((ownerProfiles ?? []).map((profile) => [profile.id, profile]));
  const stats = parseAdminStats(statsData);

  const bookings = view === 'bookings'
    ? (await supabase
      .from('bookings')
      .select('id, code, starts_at, status, total_amount, customer_name, courts(name, venues(name))')
      .order('starts_at', { ascending: false }).limit(30)).data ?? []
    : [];
  const users = view === 'users'
    ? (await supabase.from('profiles').select('id, full_name, phone, role, created_at').order('created_at', { ascending: false }).limit(30)).data ?? []
    : [];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <DashboardPageHeader eyebrow="Quản trị / Vận hành" title={{ overview: 'Tổng quan vận hành', owners: 'Hồ sơ chủ sân', venues: 'Hồ sơ cụm sân', bookings: 'Đơn đặt sân', users: 'Tài khoản gần đây' }[view]}
        description={{ overview: 'Theo dõi giao dịch và xử lý các hồ sơ đang chờ.', owners: 'Kiểm tra thông tin đại diện và giấy tờ trước khi duyệt tài khoản chủ sân.', venues: 'Theo dõi trạng thái các cụm sân. Hồ sơ chờ từ luồng cũ được duyệt tại đây.', bookings: 'Xem 30 đơn gần nhất, thông tin khách và trạng thái thanh toán.', users: 'Xem tài khoản mới hoặc mở quản lý người dùng để chỉnh quyền truy cập.' }[view]}
        actions={view === 'overview' ? <DashboardLink href="/admin?view=owners">Duyệt hồ sơ chủ sân</DashboardLink> : view === 'users' ? <DashboardLink href="/admin/users">Quản lý người dùng</DashboardLink> : undefined} />
      {view === 'overview' && <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[{ href: '/admin?view=owners', label: 'Chủ sân chờ duyệt', value: pendingOwners.length, icon: ShieldCheck }, { href: '/admin?view=venues', label: 'Cụm sân hoạt động', value: activeVenues.length, icon: Building2 }, { href: '/admin/users', label: 'Tài khoản trên hệ thống', value: ownerProfiles?.length ?? 0, icon: Users }].map(({ href, label, value, icon: Icon }) => <Link key={href} href={href} className="pf-card flex items-center gap-3 rounded-card border border-hairline bg-card p-4 hover:border-strong"><span className="grid size-10 shrink-0 place-items-center rounded-control bg-free-fill text-pitch"><Icon size={19} aria-hidden="true" /></span><div className="min-w-0 flex-1"><strong className="block font-display text-2xl font-bold tabular-nums text-pitch">{value}</strong><span className="text-xs text-ink-secondary">{label}</span></div><ArrowUpRight size={15} className="shrink-0 text-ink-secondary" aria-hidden="true" /></Link>)}
        </div>
        <Overview pendingOwners={pendingOwners} pendingVenues={pendingVenues} activeVenueCount={activeVenues.length} profileById={profileById} />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-pitch">Thống kê giao dịch</p><PeriodLinks path="/admin" period={period} /></div>
        <AdminStatsPanel stats={stats} />
      </>}
      {view === 'owners' && <OwnerTable owners={(ownerProfiles ?? []).filter((profile) => profile.owner_application_status)} />}
      {view === 'venues' && <VenueTable venues={venues ?? []} profileById={profileById} />}
      {view === 'bookings' && <BookingTable bookings={bookings} />}
      {view === 'users' && <UserTable users={users} />}
    </main>
  );
}

function Overview({ pendingOwners, pendingVenues, activeVenueCount, profileById }: { pendingOwners: OwnerProfile[]; pendingVenues: VenueRow[]; activeVenueCount: number; profileById: Map<string, OwnerProfile> }) {
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-card border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h2 className="font-semibold">Hồ sơ cần xử lý</h2>
            <p className="mt-1 text-xs text-ink-secondary">Duyệt tài khoản trước; chủ sân thêm cụm sân và ảnh để công khai.</p>
          </div>
          <Link href="/admin?view=owners" className="pf-action inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-pitch">Xem chủ sân</Link>
        </div>
        {pendingOwners.length === 0 && pendingVenues.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-secondary">Không có hồ sơ nào đang chờ duyệt.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {pendingOwners.slice(0, 6).map((owner) => <OwnerRowItem key={owner.id} owner={owner} />)}
            {pendingVenues.slice(0, 6).map((venue) => <VenueRowItem key={venue.id} venue={venue} profile={profileById.get(venue.owner_id)} />)}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-hairline bg-card p-5">
        <h2 className="font-semibold">Tình hình hệ thống</h2>
        <div className="mt-5 space-y-4">
          <ProgressRow label="Cụm sân đang hoạt động" value={activeVenueCount} total={activeVenueCount + pendingVenues.length} />
          <div className="border-t border-hairline pt-4">
            <p className="text-sm font-medium">Việc cần làm tiếp theo</p>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">Kiểm tra giấy tờ và thông tin đại diện. Cụm sân mới tự công khai khi chủ sân đã duyệt lưu đủ ảnh.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

type VenueRow = { id: string; name: string; slug: string; district: string; status: VenueStatus; owner_id: string; created_at: string; phone: string | null; business_license_path: string | null };
type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role?: string;
  owner_application_status?: string | null;
  business_license_path?: string | null;
  business_license_name?: string | null;
  payout_bank?: string | null;
  payout_account?: string | null;
  created_at?: string;
};

function OwnerRowItem({ owner }: { owner: OwnerProfile }) {
  return <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><Link href={`/admin/owners/${owner.id}`} className="font-semibold text-pitch underline-offset-4 hover:underline">{owner.full_name ?? 'Chưa có tên'}</Link><p className="mt-1 text-xs text-ink-secondary">{owner.phone ?? 'Chưa có số điện thoại'} · Đăng ký tài khoản chủ sân</p></div><div className="flex items-center gap-3">{owner.business_license_path && <a href={`/api/admin/owners/${owner.id}/license`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-pitch underline underline-offset-4">Giấy tờ</a>}<AdminOwnerAction ownerId={owner.id} /></div></li>;
}

function OwnerTable({ owners }: { owners: OwnerProfile[] }) {
  const sortedOwners = [...owners].sort((a, b) => {
    if (a.owner_application_status === 'pending' && b.owner_application_status !== 'pending') return -1;
    if (a.owner_application_status !== 'pending' && b.owner_application_status === 'pending') return 1;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
  return <DashboardRecords title="Danh sách hồ sơ chủ sân" description="Hồ sơ chờ duyệt được xếp trước. Tìm theo tên hoặc số điện thoại."
    mobilePrimary={[4, 5]} columns={['Người đại diện', 'Tài khoản nhận cọc', 'Giấy tờ', 'Ngày gửi', 'Trạng thái', 'Thao tác']}
    statuses={[{ value: 'pending', label: 'Chờ duyệt' }, { value: 'active', label: 'Đã duyệt' }, { value: 'rejected', label: 'Bị từ chối' }]}
    records={sortedOwners.map(owner => ({ id: owner.id, search: `${owner.full_name ?? ''} ${owner.phone ?? ''}`, status: owner.owner_application_status ?? '', cells: [
      <div key="name"><Link href={`/admin/owners/${owner.id}`} className="font-semibold text-pitch hover:underline">{owner.full_name ?? 'Chưa có tên'}</Link><p className="mt-1 text-xs text-ink-secondary">{owner.phone ?? 'Chưa có số điện thoại'}</p></div>,
      <div key="bank">{owner.payout_bank ?? 'Chưa có ngân hàng'}<p className="mt-1 text-xs tabular-nums text-ink-secondary">{owner.payout_account ?? 'Chưa có số tài khoản'}</p></div>,
      owner.business_license_path ? <a key="license" href={`/api/admin/owners/${owner.id}/license`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-pitch underline underline-offset-4">Mở giấy tờ ↗</a> : 'Chưa có',
      owner.created_at ? dayLabel(new Date(owner.created_at)) : '—',
      <OwnerApplicationStatus key="status" status={owner.owner_application_status} />,
      owner.owner_application_status === 'pending' ? <AdminOwnerAction key="action" ownerId={owner.id} /> : <Link key="detail" href={`/admin/owners/${owner.id}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-pitch">Xem hồ sơ ↗</Link>,
    ] }))} />;
}

function OwnerApplicationStatus({ status }: { status?: string | null }) {
  const labels: Record<string, string> = { pending: 'Chờ duyệt', active: 'Đã duyệt', rejected: 'Bị từ chối' };
  const styles: Record<string, string> = { pending: 'bg-peak-fill text-peak-ink', active: 'bg-free-fill text-pitch', rejected: 'bg-sunk text-ink-secondary' };
  return <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${styles[status ?? ''] ?? 'bg-sunk text-ink-secondary'}`}>{labels[status ?? ''] ?? 'Chưa có trạng thái'}</span>;
}

function VenueRowItem({ venue, profile }: { venue: VenueRow; profile?: OwnerProfile }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{venue.name}</p>
        <p className="mt-1 text-xs text-ink-secondary">{profile?.full_name ?? 'Chưa có tên'} · {profile?.phone ?? venue.phone ?? 'Chưa có số điện thoại'} · {venue.district}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-pill bg-peak-fill px-2.5 py-1 text-xs font-medium text-peak-ink">{VENUE_STATUS_LABELS[venue.status]}</span>
        {venue.business_license_path && <a href={`/api/admin/venues/${venue.id}/license`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-pitch underline underline-offset-4">Giấy tờ</a>}
        <AdminVenueAction venueId={venue.id} />
      </div>
    </li>
  );
}

function VenueTable({ venues, profileById }: { venues: VenueRow[]; profileById: Map<string, OwnerProfile> }) {
  return <DashboardRecords title="Danh sách cụm sân" description="Tìm theo tên sân, khu vực hoặc người đại diện."
    mobilePrimary={[2, 4, 5]} columns={['Cụm sân', 'Người đại diện', 'Khu vực', 'Ngày tạo', 'Trạng thái', 'Thao tác']}
    statuses={Object.entries(VENUE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    records={venues.map(venue => ({ id: venue.id, search: `${venue.name} ${venue.district} ${profileById.get(venue.owner_id)?.full_name ?? ''} ${venue.phone ?? ''}`, status: venue.status, cells: [
      <div key="venue" className="font-semibold text-pitch">{venue.name}<p className="mt-1 text-xs font-normal text-ink-secondary">{venue.slug}</p></div>,
      <div key="owner">{profileById.get(venue.owner_id)?.full_name ?? 'Chưa có tên'}<p className="mt-1 text-xs text-ink-secondary">{profileById.get(venue.owner_id)?.phone ?? venue.phone ?? 'Chưa có số điện thoại'}</p></div>,
      venue.district, dayLabel(new Date(venue.created_at)),
      <span key="status" className={`inline-flex rounded-pill px-2.5 py-1.5 text-xs font-semibold ${venue.status === 'active' ? 'bg-free-fill text-pitch' : venue.status === 'pending' ? 'bg-peak-fill text-peak-ink' : 'bg-sunk text-ink-secondary'}`}>{VENUE_STATUS_LABELS[venue.status]}</span>,
      <div key="action" className="flex flex-wrap gap-2">{venue.status === 'pending' ? <AdminVenueAction venueId={venue.id} /> : venue.status === 'active' ? <Link href={`/san/${venue.slug}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-pitch">Xem sân ↗</Link> : '—'}{venue.business_license_path && <a href={`/api/admin/venues/${venue.id}/license`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-pitch underline underline-offset-4">Giấy tờ</a>}</div>,
    ] }))} />;
}

function BookingTable({ bookings }: { bookings: Array<{ id: string; code: string; starts_at: string; status: BookingStatus; total_amount: number; customer_name: string | null; courts: unknown }> }) {
  return <DashboardRecords title="Đơn đặt sân gần đây" description="30 đơn gần nhất theo thời gian chơi."
    mobilePrimary={[1, 4]} columns={['Mã đơn', 'Khách', 'Thời gian', 'Giá trị', 'Trạng thái']}
    records={bookings.map(b => ({ id: b.id, search: `${b.code} ${b.customer_name ?? ''}`, status: b.status, cells: [<strong key="code" className="font-mono text-pitch">{b.code}</strong>, b.customer_name ?? 'Khách đặt sân', `${dayLabel(new Date(b.starts_at))} · ${hhmm(b.starts_at)}`, <span key="amount" className="font-semibold tabular-nums text-pitch">{vnd(b.total_amount)}</span>, <StatusBadge key="status" status={b.status} />] }))} />;
}

function UserTable({ users }: { users: Array<{ id: string; full_name: string | null; phone: string | null; role: string; created_at: string }> }) {
  return <DashboardRecords title="Tài khoản gần đây" description="Mở mục Người dùng để chỉnh vai trò và quyền truy cập."
    mobilePrimary={[1, 2]} columns={['Tên', 'Liên hệ', 'Vai trò', 'Ngày tạo']}
    records={users.map(u => ({ id: u.id, search: `${u.full_name ?? ''} ${u.phone ?? ''}`, status: u.role, cells: [u.full_name ?? 'Chưa cập nhật', u.phone ?? '—', u.role === 'admin' ? 'Quản trị viên' : u.role === 'owner' ? 'Chủ sân' : 'Người chơi', dayLabel(new Date(u.created_at))] }))} />;
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total ? Math.round(value / total * 100) : 0;
  return <div><div className="flex justify-between gap-4 text-sm"><span>{label}</span><strong>{value}</strong></div><div className="mt-2 h-2 rounded-pill bg-sunk"><div className="h-full rounded-pill bg-pitch" style={{ width: `${width}%` }} /></div></div>;
}

function parseView(value?: string): View {
  return value === 'owners' || value === 'venues' || value === 'bookings' || value === 'users' ? value : 'overview';
}
