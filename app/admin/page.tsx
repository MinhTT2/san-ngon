import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, CalendarCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AdminVenueAction } from '@/components/admin-venue-action';
import { AdminOwnerAction } from '@/components/admin-owner-action';
import { VENUE_STATUS_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import type { BookingStatus, VenueStatus } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản trị · Sân Ngon' };

type View = 'overview' | 'owners' | 'venues' | 'bookings' | 'users';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

  const view = parseView((await searchParams).view);
  const [{ data: venues, error: venuesError }, { data: ownerProfiles }, { count: bookingCount }, { count: userCount }] = await Promise.all([
    supabase.from('venues').select('id, name, slug, district, status, owner_id, created_at, phone, business_license_path').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, phone, role, owner_application_status, business_license_path, business_license_name, payout_bank, payout_account, created_at'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);
  if (venuesError) throw new Error('Không tải được hồ sơ sân. Vui lòng thử lại.');

  const pendingVenues = (venues ?? []).filter((venue) => venue.status === 'pending');
  const pendingOwners = (ownerProfiles ?? []).filter((profile) => profile.owner_application_status === 'pending');
  const activeVenues = (venues ?? []).filter((venue) => venue.status === 'active');
  const profileById = new Map((ownerProfiles ?? []).map((profile) => [profile.id, profile]));

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
    <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-secondary">Thứ hai, {dayLabel(new Date())}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-pitch">Tổng quan vận hành</h1>
        </div>
        <Link href="/" className="rounded-control border border-hairline bg-card px-4 py-2.5 text-sm font-medium text-ink-secondary hover:border-strong">
          Xem trang đặt sân ↗
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <AdminStat icon={Building2} value={String(pendingOwners.length + pendingVenues.length)} label="Hồ sơ chờ duyệt" tone={pendingOwners.length + pendingVenues.length ? 'peak' : undefined} />
        <AdminStat icon={CalendarCheck} value={String(bookingCount ?? 0)} label="Tổng đơn đặt sân" />
        <AdminStat icon={Users} value={String(userCount ?? 0)} label="Tài khoản" />
      </div>

      {view === 'overview' && (
        <Overview pendingOwners={pendingOwners} pendingVenues={pendingVenues} activeVenueCount={activeVenues.length} profileById={profileById} />
      )}
      {view === 'owners' && <OwnerTable owners={(ownerProfiles ?? []).filter((profile) => profile.owner_application_status)} />}
      {view === 'venues' && <VenueTable venues={venues ?? []} profileById={profileById} />}
      {view === 'bookings' && <BookingTable bookings={bookings} />}
      {view === 'users' && <UserTable users={users} />}
    </main>
  );
}

function Overview({ pendingOwners, pendingVenues, activeVenueCount, profileById }: { pendingOwners: OwnerProfile[]; pendingVenues: VenueRow[]; activeVenueCount: number; profileById: Map<string, OwnerProfile> }) {
  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-card border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h2 className="font-semibold">Hồ sơ cần xử lý</h2>
            <p className="mt-1 text-xs text-ink-secondary">Duyệt xong, sân sẽ xuất hiện trên trang tìm sân.</p>
          </div>
          <Link href="/admin?view=venues" className="text-sm font-semibold text-pitch">Xem tất cả</Link>
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
            <p className="mt-1 text-sm leading-6 text-ink-secondary">Kiểm tra thông tin liên hệ và bảng giá trước khi duyệt hồ sơ.</p>
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
  return <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="font-semibold">{owner.full_name ?? 'Chưa có tên'}</p><p className="mt-1 text-xs text-ink-secondary">{owner.phone ?? 'Chưa có số điện thoại'} · Đăng ký tài khoản chủ sân</p></div><div className="flex items-center gap-3">{owner.business_license_path && <a href={`/api/admin/owners/${owner.id}/license`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-pitch underline underline-offset-4">Giấy tờ</a>}<AdminOwnerAction ownerId={owner.id} /></div></li>;
}

function OwnerTable({ owners }: { owners: OwnerProfile[] }) {
  const sortedOwners = [...owners].sort((a, b) => {
    if (a.owner_application_status === 'pending' && b.owner_application_status !== 'pending') return -1;
    if (a.owner_application_status !== 'pending' && b.owner_application_status === 'pending') return 1;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
  return (
    <section className="mt-8 overflow-hidden rounded-card border border-hairline bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <h2 className="font-semibold">Hồ sơ chủ sân</h2>
          <p className="mt-1 text-xs text-ink-secondary">Xem hồ sơ đang chờ, đã duyệt và bị từ chối.</p>
        </div>
        <span className="rounded-pill bg-sunk px-2.5 py-1 text-xs font-semibold text-ink-secondary">{owners.length} hồ sơ</span>
      </div>
      {owners.length === 0 ? (
        <p className="p-10 text-center text-sm text-ink-secondary">Chưa có hồ sơ chủ sân nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="border-b border-hairline text-left text-xs text-ink-secondary"><th className="px-5 py-3 font-medium">Người đại diện</th><th className="px-5 py-3 font-medium">Tài khoản nhận cọc</th><th className="px-5 py-3 font-medium">Giấy tờ</th><th className="px-5 py-3 font-medium">Ngày gửi</th><th className="px-5 py-3 font-medium">Trạng thái</th><th className="px-5 py-3" /></tr></thead>
            <tbody>
              {sortedOwners.map((owner) => (
                <tr key={owner.id} className="border-b border-hairline last:border-0 align-top">
                  <td className="px-5 py-4"><p className="font-semibold">{owner.full_name ?? 'Chưa có tên'}</p><p className="mt-1 text-xs text-ink-secondary">{owner.phone ?? 'Chưa có số điện thoại'}</p></td>
                  <td className="px-5 py-4"><p>{owner.payout_bank ?? 'Chưa có ngân hàng'}</p><p className="mt-1 text-xs tabular-nums text-ink-secondary">{owner.payout_account ?? 'Chưa có số tài khoản'}</p></td>
                  <td className="px-5 py-4">{owner.business_license_path ? <a href={`/api/admin/owners/${owner.id}/license`} target="_blank" rel="noreferrer" className="font-semibold text-pitch underline underline-offset-4">{owner.business_license_name ?? 'Mở giấy tờ'} ↗</a> : <span className="text-ink-secondary">Chưa có</span>}</td>
                  <td className="px-5 py-4 text-ink-secondary">{owner.created_at ? dayLabel(new Date(owner.created_at)) : '—'}</td>
                  <td className="px-5 py-4"><OwnerApplicationStatus status={owner.owner_application_status} /></td>
                  <td className="px-5 py-4 text-right">{owner.owner_application_status === 'pending' && <AdminOwnerAction ownerId={owner.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
  return (
    <section className="mt-8 overflow-hidden rounded-card border border-hairline bg-card">
      <div className="border-b border-hairline px-5 py-4"><h2 className="font-semibold">Tất cả hồ sơ sân</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead><tr className="border-b border-hairline text-left text-xs text-ink-secondary"><th className="px-5 py-3 font-medium">Cụm sân</th><th className="px-5 py-3 font-medium">Người đại diện</th><th className="px-5 py-3 font-medium">Khu vực</th><th className="px-5 py-3 font-medium">Ngày gửi</th><th className="px-5 py-3 font-medium">Trạng thái</th><th className="px-5 py-3" /></tr></thead>
          <tbody>{venues.map((venue) => <tr key={venue.id} className="border-b border-hairline last:border-0"><td className="px-5 py-4 font-semibold">{venue.name}<span className="mt-1 block text-xs font-normal text-ink-secondary">{venue.slug}</span></td><td className="px-5 py-4">{profileById.get(venue.owner_id)?.full_name ?? 'Chưa có tên'}<span className="mt-1 block text-xs font-normal text-ink-secondary">{profileById.get(venue.owner_id)?.phone ?? venue.phone ?? 'Chưa có số điện thoại'}</span></td><td className="px-5 py-4">{venue.district}</td><td className="px-5 py-4 text-ink-secondary">{dayLabel(new Date(venue.created_at))}</td><td className="px-5 py-4"><span className="rounded-pill bg-sunk px-2.5 py-1 text-xs font-medium">{VENUE_STATUS_LABELS[venue.status]}</span></td><td className="px-5 py-4 text-right"><span className="inline-flex items-center gap-3">{venue.business_license_path && <a href={`/api/admin/venues/${venue.id}/license`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-pitch underline underline-offset-4">Giấy tờ</a>}{venue.status === 'pending' && <AdminVenueAction venueId={venue.id} />}</span></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function BookingTable({ bookings }: { bookings: Array<{ id: string; code: string; starts_at: string; status: BookingStatus; total_amount: number; customer_name: string | null; courts: unknown }> }) {
  return <section className="mt-8 overflow-hidden rounded-card border border-hairline bg-card"><div className="border-b border-hairline px-5 py-4"><h2 className="font-semibold">Đơn đặt sân gần đây</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-hairline text-left text-xs text-ink-secondary"><th className="px-5 py-3 font-medium">Mã đơn</th><th className="px-5 py-3 font-medium">Khách</th><th className="px-5 py-3 font-medium">Thời gian</th><th className="px-5 py-3 text-right font-medium">Giá trị</th><th className="px-5 py-3 font-medium">Trạng thái</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} className="border-b border-hairline last:border-0"><td className="px-5 py-4 font-semibold">{booking.code}</td><td className="px-5 py-4">{booking.customer_name ?? 'Khách đặt sân'}</td><td className="px-5 py-4 text-ink-secondary">{dayLabel(new Date(booking.starts_at))} · {hhmm(booking.starts_at)}</td><td className="px-5 py-4 text-right tabular-nums">{vnd(booking.total_amount)}</td><td className="px-5 py-4"><StatusBadge status={booking.status} /></td></tr>)}</tbody></table></div>{bookings.length === 0 && <p className="p-10 text-center text-sm text-ink-secondary">Chưa có đơn đặt sân.</p>}</section>;
}

function UserTable({ users }: { users: Array<{ id: string; full_name: string | null; phone: string | null; role: string; created_at: string }> }) {
  return <section className="mt-8 overflow-hidden rounded-card border border-hairline bg-card"><div className="border-b border-hairline px-5 py-4"><h2 className="font-semibold">Tài khoản gần đây</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b border-hairline text-left text-xs text-ink-secondary"><th className="px-5 py-3 font-medium">Tên</th><th className="px-5 py-3 font-medium">Liên hệ</th><th className="px-5 py-3 font-medium">Vai trò</th><th className="px-5 py-3 font-medium">Ngày tạo</th></tr></thead><tbody>{users.map((item) => <tr key={item.id} className="border-b border-hairline last:border-0"><td className="px-5 py-4 font-semibold">{item.full_name ?? 'Chưa cập nhật'}</td><td className="px-5 py-4 text-ink-secondary">{item.phone ?? '—'}</td><td className="px-5 py-4 capitalize">{item.role}</td><td className="px-5 py-4 text-ink-secondary">{dayLabel(new Date(item.created_at))}</td></tr>)}</tbody></table></div></section>;
}

function AdminStat({ icon: Icon, value, label, tone }: { icon: typeof Building2; value: string; label: string; tone?: 'peak' }) {
  return <div className="flex items-center gap-4 rounded-card border border-hairline bg-card p-5"><span className={`flex size-11 items-center justify-center rounded-control ${tone === 'peak' ? 'bg-peak-fill text-peak-ink' : 'bg-free-fill text-pitch'}`}><Icon className="size-5" aria-hidden="true" /></span><span><strong className="block font-display text-2xl font-bold text-pitch">{value}</strong><span className="text-xs text-ink-secondary">{label}</span></span></div>;
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total ? Math.round(value / total * 100) : 0;
  return <div><div className="flex justify-between gap-4 text-sm"><span>{label}</span><strong>{value}</strong></div><div className="mt-2 h-2 rounded-pill bg-sunk"><div className="h-full rounded-pill bg-pitch" style={{ width: `${width}%` }} /></div></div>;
}

function parseView(value?: string): View {
  return value === 'owners' || value === 'venues' || value === 'bookings' || value === 'users' ? value : 'overview';
}
