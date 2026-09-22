import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { VenueReview } from '@/components/admin/venue-review';
import { StatTile } from '@/components/charts/stat-tile';
import { RevenueArea, type RevenuePoint } from '@/components/charts/revenue-area';
import { OccupancyHeatmap, type OccupancyCell } from '@/components/charts/occupancy-heatmap';
import { OwnerReview } from '@/components/admin/owner-review';
import { UserRowActions } from '@/components/admin/user-row-actions';
import { ROLE_LABELS, VENUE_STATUS_LABELS } from '@/lib/constants';
import { ownerChecklist, waitingFor, OWNER_STATUS_LABELS } from '@/lib/owner-review';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';
import type { AdminUserRow, BookingStatus, VenueStatus } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản trị · Sân Ngon' };

type View = 'overview' | 'owners' | 'venues' | 'bookings' | 'users';

type Summary = {
  doanh_thu: number; doanh_thu_truoc: number;
  so_don: number; so_don_truoc: number;
  so_don_huy: number; ty_le_lap_day: number;
};

type Search = { view?: string; q?: string; vai_tro?: string; trang_thai?: string; trang?: string; ho_so?: string; san?: string };

const USERS_PER_PAGE = 25;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

  const sp = await searchParams;
  const view = parseView(sp.view);

  // Ba lượt gọi song song với phần còn lại của trang; mọi phép tính nằm trong
  // Postgres, Node chỉ vẽ lại.
  const [summary, revenue, occupancy] = await Promise.all([
    supabase.rpc('stats_summary', { p_venue_id: null, p_days: 30 }).single(),
    supabase.rpc('stats_revenue_daily', { p_venue_id: null, p_days: 30 }),
    supabase.rpc('stats_occupancy_grid', { p_venue_id: null, p_days: 28 }),
  ]);
  const tongQuan = summary.data as Summary | null;
  const doanhThu = (revenue.data ?? []) as RevenuePoint[];
  const luoiLapDay = (occupancy.data ?? []) as OccupancyCell[];
  const [{ data: venues, error: venuesError }, { data: ownerProfiles }, { count: userCount }] = await Promise.all([
    supabase.from('venues').select('id, name, slug, district, status, owner_id, created_at, phone, business_license_path, hidden_reason, reviewed_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, phone, role, owner_application_status, owner_rejection_reason, owner_reviewed_at, business_license_path, business_license_name, payout_bank, payout_account, created_at'),
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
  // Bảng tài khoản đi qua admin_list_users() chứ không đọc thẳng profiles: email
  // nằm ở auth.users, và số đơn/số cụm sân đếm trong SQL thì rẻ hơn kéo cả bảng
  // về rồi đếm ở Node.
  const userPage = Math.max(1, Number(sp.trang) || 1);
  const userFilter = {
    q: (sp.q ?? '').trim(),
    role: pickOne(sp.vai_tro, ['player', 'owner', 'admin']),
    status: pickOne(sp.trang_thai, ['active', 'banned']),
  };
  const users = view === 'users'
    ? ((await supabase.rpc('admin_list_users', {
        p_q: userFilter.q || null,
        p_role: userFilter.role,
        p_status: userFilter.status,
        p_limit: USERS_PER_PAGE,
        p_offset: (userPage - 1) * USERS_PER_PAGE,
      })).data ?? []) as AdminUserRow[]
    : [];

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* dayLabel() đã trả sẵn thứ; ghép thêm "Thứ hai," ở đây thì mọi ngày
            đều in ra "Thứ hai, Thứ Ba, 22/09". */}
        <p className="text-sm font-medium capitalize text-ink-secondary">{dayLabel(new Date())}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-pitch">Tổng quan vận hành</h1>
        </div>
        <Link href="/" className="rounded-control border border-hairline bg-card px-4 py-2.5 text-sm font-medium text-ink-secondary hover:border-strong">
          Xem trang đặt sân ↗
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Tiền cọc 30 ngày"
          value={trieu(tongQuan?.doanh_thu ?? 0)}
          unit="triệu"
          delta={tyLe(tongQuan?.doanh_thu, tongQuan?.doanh_thu_truoc)}
          spark={doanhThu.map((d) => d.doanh_thu)}
        />
        <StatTile
          label="Đơn đã thanh toán 30 ngày"
          value={String(tongQuan?.so_don ?? 0)}
          delta={tyLe(tongQuan?.so_don, tongQuan?.so_don_truoc)}
          spark={doanhThu.map((d) => d.so_don)}
        />
        <StatTile
          label="Lấp đầy trung bình 28 ngày"
          value={`${Math.round((tongQuan?.ty_le_lap_day ?? 0) * 100)}%`}
          deltaLabel={`${tongQuan?.so_don_huy ?? 0} đơn huỷ hoặc không đến`}
          delta={null}
        />
        <StatTile
          label="Hồ sơ chủ sân chờ duyệt"
          value={String(pendingOwners.length)}
          tone={pendingOwners.length ? 'peak' : undefined}
          deltaLabel={`${activeVenues.length} cụm sân đang chạy · ${userCount ?? 0} tài khoản`}
          delta={null}
        />
      </div>

      {view === 'overview' && (
        <Overview pendingOwners={pendingOwners} pendingVenues={pendingVenues} activeVenueCount={activeVenues.length}
          profileById={profileById} doanhThu={doanhThu} luoiLapDay={luoiLapDay} />
      )}
      {view === 'owners' && (
        <OwnerTable
          owners={(ownerProfiles ?? []).filter((profile) => profile.owner_application_status)}
          tab={pickOne(sp.ho_so, ['pending', 'active', 'rejected']) ?? 'pending'}
        />
      )}
      {view === 'venues' && (
        <VenueTable
          venues={venues ?? []}
          profileById={profileById}
          tab={pickOne(sp.san, ['active', 'pending', 'rejected', 'draft']) ?? (pendingVenues.length > 0 ? 'pending' : 'active')}
        />
      )}
      {view === 'bookings' && <BookingTable bookings={bookings} />}
      {view === 'users' && <UserTable users={users} filter={userFilter} page={userPage} meId={user.id} />}
    </main>
  );
}

function Overview({ pendingOwners, pendingVenues, activeVenueCount, profileById, doanhThu, luoiLapDay }: { pendingOwners: OwnerProfile[]; pendingVenues: VenueRow[]; activeVenueCount: number; profileById: Map<string, OwnerProfile>; doanhThu: RevenuePoint[]; luoiLapDay: OccupancyCell[] }) {
  // Hồ sơ chờ lâu nhất lên đầu — đó là cái sắp mất khách.
  const owners = [...pendingOwners].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  const oldest = owners[0]?.created_at;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Lưới lấp đầy cần cả 18 cột giờ nên ăn trọn bề ngang; nhét vào nửa trang
          là cắt mất đúng khung giờ vàng. */}
      <section className="rounded-card border border-hairline bg-card p-5 sm:p-6">
        <h2 className="font-semibold">Tiền cọc về tài khoản</h2>
        <p className="mt-1 text-xs text-ink-secondary">30 ngày gần nhất, toàn hệ thống.</p>
        <div className="mt-5">
          <RevenueArea data={doanhThu} />
        </div>
      </section>

      <section className="rounded-card border border-hairline bg-card p-5 sm:p-6">
        <h2 className="font-semibold">Khung giờ nào đang kín</h2>
        <p className="mt-1 text-xs text-ink-secondary">Tỉ lệ lấp đầy 28 ngày gần nhất, theo giờ và thứ.</p>
        <div className="mt-5">
          <OccupancyHeatmap data={luoiLapDay}
            subtitle="Mẫu số là số lượt có thể bán: mỗi sân con, mỗi lần thứ đó xuất hiện." />
        </div>
      </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        {/* Hai loại hồ sơ tách hẳn hai khối. Trước đây chúng nằm chung một danh
            sách nên nhìn không ra đang duyệt người hay duyệt sân — hai việc khác
            nhau: duyệt người mở quyền nhận tiền, duyệt sân chỉ mở hiển thị. */}
        <section className="rounded-card border border-hairline bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div>
              <h2 className="font-semibold">Hồ sơ chủ sân chờ duyệt</h2>
              <p className="mt-1 text-xs text-ink-secondary">
                Duyệt xong, họ mới đăng được sân và nhận được tiền cọc của khách.
              </p>
            </div>
            <Link href="/admin?view=owners&ho_so=pending" className="text-sm font-semibold text-pitch">Xem tất cả</Link>
          </div>
          {owners.length === 0 ? (
            <p className="p-10 text-center text-sm text-ink-secondary">Không còn hồ sơ chủ sân nào chờ duyệt.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {owners.slice(0, 5).map((owner) => <OwnerRowItem key={owner.id} owner={owner} />)}
            </ul>
          )}
        </section>

        {pendingVenues.length > 0 && (
          <section className="rounded-card border border-hairline bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div>
                <h2 className="font-semibold">Cụm sân chờ duyệt</h2>
                <p className="mt-1 text-xs text-ink-secondary">Duyệt xong, sân sẽ xuất hiện trên trang tìm sân.</p>
              </div>
              <Link href="/admin?view=venues" className="text-sm font-semibold text-pitch">Xem tất cả</Link>
            </div>
            <ul className="divide-y divide-hairline">
              {pendingVenues.slice(0, 5).map((venue) => <VenueRowItem key={venue.id} venue={venue} profile={profileById.get(venue.owner_id)} />)}
            </ul>
          </section>
        )}
      </div>

      <section className="rounded-card border border-hairline bg-card p-5">
        <h2 className="font-semibold">Việc cần làm</h2>
        <div className="mt-5 space-y-4">
          <ProgressRow label="Cụm sân đang hoạt động" value={activeVenueCount} total={activeVenueCount + pendingVenues.length} />
          <div className="border-t border-hairline pt-4">
            {owners.length === 0 ? (
              <p className="mt-1 text-sm leading-6 text-ink-secondary">
                Không còn hồ sơ nào chờ. Hồ sơ mới gửi lên sẽ hiện ngay ở đây.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-ink-secondary">
                {owners.length} hồ sơ chủ sân đang chờ, cái lâu nhất đã{' '}
                <strong className="font-semibold text-peak-ink">{oldest ? waitingFor(oldest) : '—'}</strong>.
                Mở giấy phép kinh doanh ra đối chiếu tên người đại diện và số tài khoản nhận cọc trước khi duyệt.
              </p>
            )}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}

type VenueRow = { id: string; name: string; slug: string; district: string; status: VenueStatus; owner_id: string; created_at: string; phone: string | null; business_license_path: string | null; hidden_reason?: string | null; reviewed_at?: string | null };
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
  owner_rejection_reason?: string | null;
  owner_reviewed_at?: string | null;
  created_at?: string;
};

function OwnerRowItem({ owner }: { owner: OwnerProfile }) {
  const missing = ownerChecklist({
    full_name: owner.full_name ?? null,
    phone: owner.phone ?? null,
    business_license_path: owner.business_license_path ?? null,
    business_license_name: owner.business_license_name ?? null,
    payout_bank: owner.payout_bank ?? null,
    payout_account: owner.payout_account ?? null,
  }).filter((c) => !c.ok);

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <Link href={`/admin/owners/${owner.id}`} className="font-semibold text-pitch underline-offset-4 hover:underline">
          {owner.full_name ?? 'Chưa có tên'}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-secondary">
          <span>{owner.phone ?? 'Chưa có số điện thoại'}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-peak-ink">
            <Clock className="size-3.5" aria-hidden="true" />
            chờ {owner.created_at ? waitingFor(owner.created_at) : '—'}
          </span>
          {missing.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-danger">
                thiếu {missing.map((m) => m.label.toLowerCase()).join(', ')}
              </span>
            </>
          )}
        </p>
      </div>
      <Link href={`/admin/owners/${owner.id}`}
        className="flex h-9 items-center rounded-control border border-hairline px-3.5 text-xs font-semibold text-pitch">
        Xem hồ sơ →
      </Link>
    </li>
  );
}

function OwnerTable({ owners, tab }: { owners: OwnerProfile[]; tab: string }) {
  const counts = {
    pending: owners.filter((o) => o.owner_application_status === 'pending').length,
    active: owners.filter((o) => o.owner_application_status === 'active').length,
    rejected: owners.filter((o) => o.owner_application_status === 'rejected').length,
  };

  // Hồ sơ chờ lâu nhất lên đầu: để lâu là người ta bỏ đi đăng chỗ khác. Các tab
  // còn lại xếp theo lần xử lý gần nhất, vì ở đó cái mới mới là cái cần tra.
  const rows = owners
    .filter((o) => o.owner_application_status === tab)
    .sort((a, b) => tab === 'pending'
      ? (a.created_at ?? '').localeCompare(b.created_at ?? '')
      : (b.owner_reviewed_at ?? b.created_at ?? '').localeCompare(a.owner_reviewed_at ?? a.created_at ?? ''));

  return (
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-pitch">Hồ sơ chủ sân</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Duyệt xong, chủ sân mới đăng được sân và nhận được tiền cọc của khách.
          </p>
        </div>
        {/* Mặc định mở thẳng tab "Chờ duyệt": đó là việc duy nhất cần làm ở đây,
            hai tab kia chỉ để tra lại. */}
        <nav className="flex gap-1 rounded-control border border-hairline bg-card p-1">
          {([['pending', 'Chờ duyệt'], ['active', 'Đã duyệt'], ['rejected', 'Bị từ chối']] as const).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin?view=owners&ho_so=${key}`}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex h-9 items-center gap-2 rounded-[7px] px-3.5 text-sm font-medium transition-colors ${
                tab === key ? 'bg-pitch text-pitch-ink' : 'text-ink-secondary hover:bg-sunk'
              }`}
            >
              {label}
              <span className={`rounded-pill px-1.5 text-xs tabular-nums ${tab === key ? 'bg-white/15' : 'bg-sunk'}`}>
                {counts[key]}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-hairline bg-card p-12 text-center text-sm text-ink-secondary">
          {tab === 'pending'
            ? 'Không còn hồ sơ nào chờ duyệt. Xong việc rồi.'
            : tab === 'active' ? 'Chưa duyệt hồ sơ chủ sân nào.' : 'Chưa từ chối hồ sơ nào.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((owner) => <OwnerCard key={owner.id} owner={owner} />)}
        </ul>
      )}
    </section>
  );
}

/**
 * Một hồ sơ trong danh sách.
 *
 * Dạng thẻ chứ không phải dòng bảng: hồ sơ chủ sân có ba mục phải đối chiếu và
 * một lý do từ chối dài, nhồi hết vào ô bảng thì chữ xuống dòng rối và mắt
 * không bắt được mục nào đang thiếu.
 */
function OwnerCard({ owner }: { owner: OwnerProfile }) {
  const checks = ownerChecklist({
    full_name: owner.full_name ?? null,
    phone: owner.phone ?? null,
    business_license_path: owner.business_license_path ?? null,
    business_license_name: owner.business_license_name ?? null,
    payout_bank: owner.payout_bank ?? null,
    payout_account: owner.payout_account ?? null,
  });
  const pending = owner.owner_application_status === 'pending';
  const missing = checks.filter((c) => !c.ok);

  return (
    <li className="rounded-card border border-hairline bg-card">
      <div className="flex flex-wrap items-start justify-between gap-5 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={`/admin/owners/${owner.id}`} className="font-display text-lg font-bold text-pitch underline-offset-4 hover:underline">
              {owner.full_name ?? 'Chưa có tên'}
            </Link>
            <OwnerApplicationStatus status={owner.owner_application_status} />
            {pending && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-peak-ink">
                <Clock className="size-3.5" aria-hidden="true" />
                chờ {owner.created_at ? waitingFor(owner.created_at) : '—'}
              </span>
            )}
          </div>

          <dl className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-3">
            {checks.map((item) => (
              <div key={item.key} className="flex gap-2.5">
                <span aria-hidden="true" className={`mt-0.5 flex size-4.5 flex-none items-center justify-center rounded-full text-[10px] font-bold ${
                  item.ok ? 'bg-free-fill text-free-ink' : 'bg-danger/10 text-danger'
                }`}>
                  {item.ok ? '✓' : '!'}
                </span>
                <span className="min-w-0">
                  <dt className="text-xs text-ink-secondary">{item.label}</dt>
                  <dd className={`break-words text-sm ${item.ok ? '' : 'font-medium text-danger'}`}>{item.detail}</dd>
                </span>
              </div>
            ))}
          </dl>

          {owner.owner_application_status === 'rejected' && owner.owner_rejection_reason && (
            <p className="mt-4 border-t border-hairline pt-3 text-sm leading-relaxed">
              <span className="text-ink-secondary">Lý do đã gửi chủ sân: </span>
              {owner.owner_rejection_reason}
            </p>
          )}
        </div>

        <div className="flex flex-none flex-col items-end gap-2.5">
          {pending ? (
            <OwnerReview
              ownerId={owner.id}
              owner={{
                full_name: owner.full_name ?? null,
                phone: owner.phone ?? null,
                business_license_path: owner.business_license_path ?? null,
                business_license_name: owner.business_license_name ?? null,
                payout_bank: owner.payout_bank ?? null,
                payout_account: owner.payout_account ?? null,
              }}
            />
          ) : owner.owner_reviewed_at ? (
            <span className="text-xs text-ink-secondary">Xử lý {dayLabel(new Date(owner.owner_reviewed_at))}</span>
          ) : null}
          <Link href={`/admin/owners/${owner.id}`} className="text-sm font-semibold text-pitch underline-offset-4 hover:underline">
            {missing.length > 0 && pending ? 'Xem hồ sơ' : 'Xem giấy tờ'} →
          </Link>
        </div>
      </div>
    </li>
  );
}

function OwnerApplicationStatus({ status }: { status?: string | null }) {
  const styles: Record<string, string> = {
    pending: 'border-peak-line bg-peak-fill text-peak-ink',
    active: 'border-free-line bg-free-fill text-free-ink',
    rejected: 'border-danger/30 bg-danger/5 text-danger',
  };
  return (
    <span className={`rounded-pill border px-2.5 py-1 text-xs font-medium ${styles[status ?? ''] ?? 'border-hairline bg-sunk text-ink-secondary'}`}>
      {OWNER_STATUS_LABELS[status ?? ''] ?? 'Chưa có trạng thái'}
    </span>
  );
}

function VenueRowItem({ venue, profile }: { venue: VenueRow; profile?: OwnerProfile }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{venue.name}</p>
        <p className="mt-1 text-xs text-ink-secondary">
          {profile?.full_name ?? 'Chưa có tên'} · {profile?.phone ?? venue.phone ?? 'Chưa có số điện thoại'} · {venue.district}
        </p>
      </div>
      <VenueReview venueId={venue.id} venueName={venue.name} status={venue.status} />
    </li>
  );
}

function VenueTable({ venues, profileById, tab }: { venues: VenueRow[]; profileById: Map<string, OwnerProfile>; tab: string }) {
  const counts = {
    active: venues.filter((v) => v.status === 'active').length,
    pending: venues.filter((v) => v.status === 'pending').length,
    rejected: venues.filter((v) => v.status === 'rejected').length,
    draft: venues.filter((v) => v.status === 'draft').length,
  };
  const rows = venues
    .filter((v) => v.status === tab)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  return (
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-pitch">Cụm sân</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            Chủ sân đã được duyệt thì đăng sân là chạy ngay, không phải chờ ai. Chỗ này để
            gỡ xuống khi sân đăng sai hoặc khách phàn nàn — đơn đã đặt vẫn giữ nguyên.
          </p>
        </div>
        <nav className="flex gap-1 rounded-control border border-hairline bg-card p-1">
          {([['active', 'Đang chạy'], ['pending', 'Chờ duyệt'], ['rejected', 'Đã gỡ'], ['draft', 'Nháp']] as const).map(([key, label]) => (
            <Link key={key} href={`/admin?view=venues&san=${key}`}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex h-9 items-center gap-2 rounded-[7px] px-3.5 text-sm font-medium transition-colors ${
                tab === key ? 'bg-pitch text-pitch-ink' : 'text-ink-secondary hover:bg-sunk'
              }`}>
              {label}
              <span className={`rounded-pill px-1.5 text-xs tabular-nums ${tab === key ? 'bg-white/15' : 'bg-sunk'}`}>{counts[key]}</span>
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-hairline bg-card p-12 text-center text-sm text-ink-secondary">
          {tab === 'pending'
            ? 'Không có cụm sân nào chờ duyệt. Chủ sân đã duyệt thì sân của họ chạy thẳng.'
            : tab === 'rejected' ? 'Chưa gỡ cụm sân nào xuống.'
            : tab === 'draft' ? 'Không có bản nháp nào.'
            : 'Chưa có cụm sân nào đang chạy.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((venue) => {
            const owner = profileById.get(venue.owner_id);
            return (
              <li key={venue.id} className="flex flex-wrap items-start justify-between gap-5 rounded-card border border-hairline bg-card p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link href={`/san/${venue.slug}`} target="_blank" rel="noreferrer"
                      className="font-display text-lg font-bold text-pitch underline-offset-4 hover:underline">
                      {venue.name} ↗
                    </Link>
                    <VenueStatusPill status={venue.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-secondary">
                    {venue.district} · chủ sân{' '}
                    <Link href={`/admin/owners/${venue.owner_id}`} className="font-medium text-pitch underline-offset-4 hover:underline">
                      {owner?.full_name ?? 'Chưa có tên'}
                    </Link>
                    {' · '}{owner?.phone ?? venue.phone ?? 'Chưa có số điện thoại'}
                    {' · gửi '}{dayLabel(new Date(venue.created_at))}
                  </p>
                  {venue.status === 'rejected' && venue.hidden_reason && (
                    <p className="mt-3 border-t border-hairline pt-3 text-sm leading-relaxed">
                      <span className="text-ink-secondary">Lý do đã gửi chủ sân: </span>{venue.hidden_reason}
                    </p>
                  )}
                </div>
                <VenueReview venueId={venue.id} venueName={venue.name} status={venue.status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function VenueStatusPill({ status }: { status: VenueStatus }) {
  const styles: Record<string, string> = {
    active: 'border-free-line bg-free-fill text-free-ink',
    pending: 'border-peak-line bg-peak-fill text-peak-ink',
    rejected: 'border-danger/30 bg-danger/5 text-danger',
  };
  const labels: Record<string, string> = { ...VENUE_STATUS_LABELS, active: 'Đang chạy', rejected: 'Đã gỡ' };
  return (
    <span className={`rounded-pill border px-2.5 py-1 text-xs font-medium ${styles[status] ?? 'border-hairline bg-sunk text-ink-secondary'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function BookingTable({ bookings }: { bookings: Array<{ id: string; code: string; starts_at: string; status: BookingStatus; total_amount: number; customer_name: string | null; courts: unknown }> }) {
  return <section className="mt-8 overflow-hidden rounded-card border border-hairline bg-card"><div className="border-b border-hairline px-5 py-4"><h2 className="font-semibold">Đơn đặt sân gần đây</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-hairline text-left text-xs text-ink-secondary"><th className="px-5 py-3 font-medium">Mã đơn</th><th className="px-5 py-3 font-medium">Khách</th><th className="px-5 py-3 font-medium">Thời gian</th><th className="px-5 py-3 text-right font-medium">Giá trị</th><th className="px-5 py-3 font-medium">Trạng thái</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} className="border-b border-hairline last:border-0"><td className="px-5 py-4 font-semibold">{booking.code}</td><td className="px-5 py-4">{booking.customer_name ?? 'Khách đặt sân'}</td><td className="px-5 py-4 text-ink-secondary">{dayLabel(new Date(booking.starts_at))} · {hhmm(booking.starts_at)}</td><td className="px-5 py-4 text-right tabular-nums">{vnd(booking.total_amount)}</td><td className="px-5 py-4"><StatusBadge status={booking.status} /></td></tr>)}</tbody></table></div>{bookings.length === 0 && <p className="p-10 text-center text-sm text-ink-secondary">Chưa có đơn đặt sân.</p>}</section>;
}

function UserTable({ users, filter, page, meId }: {
  users: AdminUserRow[];
  filter: { q: string; role: string | null; status: string | null };
  page: number;
  meId: string;
}) {
  const total = users[0]?.tong_so ?? 0;
  const pages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));

  return (
    <section className="mt-8 flex flex-col gap-4">
      {/* Bộ lọc là <form method="get"> chứ không phải state React: lọc xong thì
          URL mang đủ điều kiện, gửi link cho nhau hoặc F5 vẫn ra đúng bảng đó. */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4">
        <input type="hidden" name="view" value="users" />
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="f-q" className="text-xs font-semibold text-ink-secondary">Tìm</label>
          <input id="f-q" name="q" defaultValue={filter.q} placeholder="Email, họ tên hoặc số điện thoại"
            className="h-11 w-full rounded-control border border-hairline bg-page px-3.5 text-[15px] focus:border-pitch focus:outline-none" />
        </div>
        <FilterSelect id="f-role" name="vai_tro" label="Vai trò" value={filter.role ?? ''}
          options={[['', 'Tất cả'], ...Object.entries(ROLE_LABELS)]} />
        <FilterSelect id="f-status" name="trang_thai" label="Trạng thái" value={filter.status ?? ''}
          options={[['', 'Tất cả'], ['active', 'Bình thường'], ['banned', 'Đang bị khoá']]} />
        <button type="submit" className="h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Lọc</button>
        {(filter.q || filter.role || filter.status) && (
          <Link href="/admin?view=users" className="flex h-11 items-center rounded-control border border-hairline px-5 text-sm font-semibold">
            Bỏ lọc
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-card border border-hairline bg-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="font-semibold">Tài khoản</h2>
          <p className="text-xs text-ink-secondary">{total} tài khoản khớp bộ lọc</p>
        </div>

        {users.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-secondary">Không có tài khoản nào khớp bộ lọc.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-ink-secondary">
                  <th className="px-5 py-3 font-medium">Người dùng</th>
                  <th className="px-5 py-3 font-medium">Vai trò</th>
                  <th className="px-5 py-3 text-right font-medium">Đơn</th>
                  <th className="px-5 py-3 text-right font-medium">Cụm sân</th>
                  <th className="px-5 py-3 font-medium">Đăng nhập gần nhất</th>
                  <th className="px-5 py-3 font-medium">Trạng thái</th>
                  <th className="px-5 py-3 font-medium"><span className="sr-only">Hành động</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-b border-hairline align-top last:border-0">
                    <td className="px-5 py-4">
                      <div className="font-semibold">
                        {item.full_name ?? <span className="font-normal text-ink-secondary">Chưa đặt tên</span>}
                        {item.id === meId && (
                          <span className="ml-2 rounded-pill border border-hairline px-2 py-0.5 text-[11px] font-normal text-ink-secondary">bạn</span>
                        )}
                      </div>
                      <div className="text-xs text-ink-secondary">{item.email}</div>
                      {item.phone && <div className="text-xs tabular-nums text-ink-secondary">{item.phone}</div>}
                    </td>
                    <td className="px-5 py-4">{ROLE_LABELS[item.role] ?? item.role}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{item.so_don}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{item.so_cum_san}</td>
                    <td className="px-5 py-4 tabular-nums text-ink-secondary">
                      {item.last_sign_in_at ? dateTime(item.last_sign_in_at) : 'Chưa bao giờ'}
                    </td>
                    <td className="px-5 py-4">
                      {item.banned_at ? (
                        <div className="flex flex-col gap-1">
                          <span className="w-fit rounded-pill border border-danger/30 bg-danger/5 px-2.5 py-1 text-xs font-semibold text-danger">Đã khoá</span>
                          {item.ban_reason && <span className="max-w-56 text-xs leading-snug text-ink-secondary">{item.ban_reason}</span>}
                        </div>
                      ) : (
                        <span className="w-fit rounded-pill border border-free-line bg-free-fill px-2.5 py-1 text-xs font-semibold text-free-ink">Bình thường</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <UserRowActions user={item} isSelf={item.id === meId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <UserPageLink filter={filter} to={page - 1} disabled={page <= 1}>← Trước</UserPageLink>
          <span className="text-ink-secondary">Trang {page}/{pages}</span>
          <UserPageLink filter={filter} to={page + 1} disabled={page >= pages}>Sau →</UserPageLink>
        </nav>
      )}
    </section>
  );
}

function FilterSelect({ id, name, label, value, options }: {
  id: string; name: string; label: string; value: string; options: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-secondary">{label}</label>
      <select id={id} name={name} defaultValue={value}
        className="h-11 rounded-control border border-hairline bg-page px-3 text-[15px] focus:border-pitch focus:outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function UserPageLink({ filter, to, disabled, children }: {
  filter: { q: string; role: string | null; status: string | null };
  to: number; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) return <span className="text-ink-secondary opacity-40">{children}</span>;
  const params = new URLSearchParams({ view: 'users' });
  if (filter.q) params.set('q', filter.q);
  if (filter.role) params.set('vai_tro', filter.role);
  if (filter.status) params.set('trang_thai', filter.status);
  params.set('trang', String(to));
  return (
    <Link href={`/admin?${params}`} className="rounded-control border border-hairline bg-card px-4 py-2 font-medium">
      {children}
    </Link>
  );
}

/** 34.590.000 → "34,6" — thẻ số liệu đọc bằng mắt, không phải để đối soát. */
function trieu(v: number) {
  return (v / 1_000_000).toFixed(1).replace('.', ',');
}

/** Tỉ lệ thay đổi so với kỳ trước; kỳ trước bằng 0 thì không có gì để so. */
function tyLe(now?: number, before?: number) {
  if (!before || before === 0 || now === undefined) return null;
  return (now - before) / before;
}

/** Giá trị lạ trên URL thì coi như không lọc, đừng đẩy thẳng xuống SQL. */
function pickOne(value: string | undefined, allowed: string[]) {
  return value && allowed.includes(value) ? value : null;
}

/**
 * ISO → "18/09/2026 20:14" theo giờ Việt Nam. Ghép tay thay vì để Intl trả cả
 * cụm: vi-VN đặt giờ lên trước ngày, đọc trong cột bảng thì hay nhầm hai số.
 */
function dateTime(iso: string) {
  const d = new Date(iso);
  const day = ymd(d);
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)} ${hhmm(iso)}`;
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total ? Math.round(value / total * 100) : 0;
  return <div><div className="flex justify-between gap-4 text-sm"><span>{label}</span><strong>{value}</strong></div><div className="mt-2 h-2 rounded-pill bg-sunk"><div className="h-full rounded-pill bg-pitch" style={{ width: `${width}%` }} /></div></div>;
}

function parseView(value?: string): View {
  return value === 'owners' || value === 'venues' || value === 'bookings' || value === 'users' ? value : 'overview';
}
