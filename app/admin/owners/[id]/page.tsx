import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Building2, CalendarCheck, CircleCheck, FileText, Phone, ShieldCheck, WalletCards } from 'lucide-react';
import { AdminOwnerAction } from '@/components/admin-owner-action';
import { createClient } from '@/lib/supabase/server';
import { dayLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Owner = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  owner_application_status: 'pending' | 'active' | 'rejected' | null;
  business_license_path: string | null;
  business_license_name: string | null;
  payout_bank: string | null;
  payout_account: string | null;
  created_at: string;
};

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin');
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') redirect('/');

  const { id } = await params;
  const { data: owner } = await supabase.from('profiles')
    .select('id, full_name, phone, role, owner_application_status, business_license_path, business_license_name, payout_bank, payout_account, created_at')
    .eq('id', id).maybeSingle() as { data: Owner | null };
  if (!owner?.owner_application_status) notFound();

  const { data: venues } = await supabase.from('venues')
    .select('id, name, slug, address, district, status, created_at')
    .eq('owner_id', id).order('created_at', { ascending: false });
  const venueIds = (venues ?? []).map((venue) => venue.id);
  const { data: courts } = venueIds.length
    ? await supabase.from('courts').select('id').in('venue_id', venueIds)
    : { data: [] as { id: string }[] };
  const courtIds = (courts ?? []).map((court) => court.id);
  const { data: bookings } = courtIds.length
    ? await supabase.from('bookings').select('status').in('court_id', courtIds)
    : { data: [] as { status: string }[] };

  const bookingRows = bookings ?? [];
  const completedBookings = bookingRows.filter((booking) => booking.status === 'completed').length;
  const confirmedBookings = bookingRows.filter((booking) => booking.status === 'confirmed').length;
  const cancelledBookings = bookingRows.filter((booking) => booking.status === 'cancelled' || booking.status === 'no_show').length;
  const activeVenues = (venues ?? []).filter((venue) => venue.status === 'active').length;

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 lg:px-10 lg:py-10">
      <Link href="/admin?view=owners" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-pitch"><ArrowLeft className="size-4" aria-hidden="true" /> Quay lại danh sách hồ sơ</Link>
      <header className="mt-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Hồ sơ chủ sân</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-pitch">{owner.full_name ?? 'Chưa có tên'}</h1>
          <p className="mt-2 text-sm text-ink-secondary">Gửi hồ sơ ngày {dayLabel(new Date(owner.created_at))}</p>
        </div>
        <div className="flex items-center gap-3">
          <OwnerStatus status={owner.owner_application_status} />
          {owner.owner_application_status === 'pending' && <AdminOwnerAction ownerId={owner.id} />}
        </div>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <EvidenceCard icon={Building2} value={`${activeVenues}/${(venues ?? []).length}`} label="Cụm sân đang hoạt động" />
        <EvidenceCard icon={CalendarCheck} value={String(completedBookings)} label="Đơn đã hoàn tất" />
        <EvidenceCard icon={CircleCheck} value={String(confirmedBookings)} label="Đơn đang xác nhận" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-card border border-hairline bg-card p-5 sm:p-7">
            <h2 className="font-display text-xl font-bold text-pitch">Thông tin đăng ký</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <Info icon={Phone} label="Số điện thoại" value={owner.phone ?? 'Chưa có'} />
              <Info icon={WalletCards} label="Tài khoản nhận cọc" value={owner.payout_bank ? `${owner.payout_bank} · ${owner.payout_account ?? 'Chưa có số tài khoản'}` : 'Chưa có'} />
              <Info icon={FileText} label="Giấy tờ kinh doanh" value={owner.business_license_path ? <a href={`/api/admin/owners/${owner.id}/license`} target="_blank" rel="noreferrer" className="font-semibold text-pitch underline underline-offset-4">{owner.business_license_name ?? 'Mở giấy tờ'} ↗</a> : 'Chưa có'} />
              <Info icon={ShieldCheck} label="Vai trò tài khoản" value={owner.role === 'owner' ? 'Chủ sân' : owner.role} />
            </dl>
          </section>

          <section className="rounded-card border border-hairline bg-card p-5 sm:p-7">
            <div className="flex items-baseline justify-between gap-4"><h2 className="font-display text-xl font-bold text-pitch">Cụm sân đã đăng ký</h2><span className="text-sm text-ink-secondary">{venues?.length ?? 0} cụm</span></div>
            {(venues ?? []).length === 0 ? <p className="mt-5 text-sm text-ink-secondary">Chưa tạo cụm sân.</p> : <ul className="mt-5 divide-y divide-hairline border-t border-hairline">{venues?.map((venue) => <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-pitch">{venue.name}</p><p className="mt-1 text-sm text-ink-secondary">{venue.address} · {venue.district}</p></div><span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${venue.status === 'active' ? 'bg-free-fill text-pitch' : 'bg-peak-fill text-peak-ink'}`}>{venue.status === 'active' ? 'Đang hoạt động' : venue.status === 'pending' ? 'Chờ duyệt' : venue.status === 'rejected' ? 'Bị từ chối' : 'Nháp'}</span></li>)}</ul>}
          </section>
        </div>

        <aside className="rounded-card border border-hairline bg-card p-5 sm:p-7">
          <h2 className="font-display text-xl font-bold text-pitch">Dữ liệu để đánh giá</h2>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">Hệ thống chưa có đánh giá sao. Các chỉ số dưới đây là dữ liệu vận hành thực tế để kiểm tra hồ sơ.</p>
          <dl className="mt-6 space-y-4 text-sm">
            <Metric label="Tổng đơn phát sinh" value={bookingRows.length} />
            <Metric label="Đơn hủy / không đến" value={cancelledBookings} />
            <Metric label="Sân con" value={courtIds.length} />
          </dl>
          <p className="mt-6 border-t border-hairline pt-5 text-xs leading-5 text-ink-secondary">Kiểm tra giấy tờ, số điện thoại, tài khoản nhận cọc và lịch sử đơn trước khi duyệt.</p>
        </aside>
      </div>
    </main>
  );
}

function OwnerStatus({ status }: { status: Owner['owner_application_status'] }) {
  const labels = { pending: 'Chờ duyệt', active: 'Đã duyệt', rejected: 'Bị từ chối' };
  const styles = { pending: 'bg-peak-fill text-peak-ink', active: 'bg-free-fill text-pitch', rejected: 'bg-sunk text-ink-secondary' };
  return <span className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${styles[status ?? 'rejected']}`}>{labels[status ?? 'rejected']}</span>;
}

function EvidenceCard({ icon: Icon, value, label }: { icon: typeof Building2; value: string; label: string }) {
  return <div className="flex items-center gap-3 rounded-card border border-hairline bg-card p-4"><Icon className="size-5 text-pitch" aria-hidden="true" /><span><strong className="block font-display text-xl font-bold text-pitch">{value}</strong><span className="text-xs text-ink-secondary">{label}</span></span></div>;
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: React.ReactNode }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-ink-secondary" aria-hidden="true" /><div><dt className="text-xs text-ink-secondary">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-ink-secondary">{label}</dt><dd className="font-semibold tabular-nums text-pitch">{value}</dd></div>;
}
