import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Building2, CalendarCheck, CircleCheck, Clock, FileText, Phone, WalletCards } from 'lucide-react';
import { OwnerReview } from '@/components/admin/owner-review';
import { LicensePreview } from '@/components/admin/license-preview';
import { createClient } from '@/lib/supabase/server';
import { dayLabel } from '@/lib/format';
import { ownerChecklist, waitingFor, OWNER_STATUS_LABELS, type OwnerApplicationStatus } from '@/lib/owner-review';

export const dynamic = 'force-dynamic';

type Owner = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  owner_application_status: OwnerApplicationStatus | null;
  owner_rejection_reason: string | null;
  owner_reviewed_at: string | null;
  business_license_path: string | null;
  business_license_name: string | null;
  payout_bank: string | null;
  payout_account: string | null;
  created_at: string;
};

/**
 * Một hồ sơ chủ sân.
 *
 * Bố cục bám việc admin thật sự làm: mở giấy phép kinh doanh ra, đối chiếu tên
 * và số tài khoản trên đó với thông tin đã khai, rồi mới quyết. Nên giấy tờ
 * chiếm cột trái, bảng đối chiếu và hai nút nằm cột phải và dính theo màn hình.
 *
 * Số liệu vận hành (đơn, sân) chỉ hiện với hồ sơ đã duyệt: hồ sơ đang chờ thì
 * chúng luôn bằng 0 — chưa duyệt thì chưa tạo được sân nào — nên để đó chỉ tổ
 * chiếm chỗ đúng lúc cần nhìn giấy tờ nhất.
 */
export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin');
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') redirect('/');

  const { id } = await params;
  const { data: owner } = await supabase.from('profiles')
    .select('id, full_name, phone, role, owner_application_status, owner_rejection_reason, owner_reviewed_at, business_license_path, business_license_name, payout_bank, payout_account, created_at')
    .eq('id', id).maybeSingle() as { data: Owner | null };
  if (!owner?.owner_application_status) notFound();

  const pending = owner.owner_application_status === 'pending';
  // Chỉ hồ sơ đã duyệt mới có gì để xem: hồ sơ đang chờ và hồ sơ bị từ chối đều
  // chưa tạo được sân nào, nên khối số liệu luôn toàn số 0.
  const approved = owner.owner_application_status === 'active';
  const checks = ownerChecklist(owner);

  // Lấy link ký ngay ở server thay vì trỏ <iframe> vào route chuyển hướng:
  // iframe không báo lỗi HTTP, nó vẽ luôn phần thân lỗi ra màn hình, nên hỏng
  // giấy tờ là admin nhìn thấy một cục JSON chứ không phải một câu tiếng Việt.
  const { data: signed } = owner.business_license_path
    ? await supabase.storage.from('venue-documents').createSignedUrl(owner.business_license_path, 300)
    : { data: null };

  const { data: venues } = await supabase.from('venues')
    .select('id, name, slug, address, district, status, created_at')
    .eq('owner_id', id).order('created_at', { ascending: false });

  // Chỉ đi đếm đơn khi hồ sơ đã duyệt — hồ sơ đang chờ thì chắc chắn chưa có gì.
  let stats = { total: 0, completed: 0, confirmed: 0, cancelled: 0, courts: 0 };
  if (approved && (venues ?? []).length) {
    const { data: courts } = await supabase.from('courts').select('id').in('venue_id', venues!.map((v) => v.id));
    const courtIds = (courts ?? []).map((c) => c.id);
    const { data: bookings } = courtIds.length
      ? await supabase.from('bookings').select('status').in('court_id', courtIds)
      : { data: [] as { status: string }[] };
    const rows = bookings ?? [];
    stats = {
      total: rows.length,
      completed: rows.filter((b) => b.status === 'completed').length,
      confirmed: rows.filter((b) => b.status === 'confirmed').length,
      cancelled: rows.filter((b) => b.status === 'cancelled' || b.status === 'no_show').length,
      courts: courtIds.length,
    };
  }

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-10 lg:py-10">
      <Link href="/admin?view=owners" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-pitch">
        <ArrowLeft className="size-4" aria-hidden="true" /> Quay lại danh sách hồ sơ
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Hồ sơ chủ sân</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-pitch">
            {owner.full_name ?? 'Chưa có tên'}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-secondary">
            <span>Gửi hồ sơ {dayLabel(new Date(owner.created_at))}</span>
            {pending && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-peak-ink">
                  <Clock className="size-3.5" aria-hidden="true" /> chờ {waitingFor(owner.created_at)}
                </span>
              </>
            )}
          </p>
        </div>
        <OwnerStatus status={owner.owner_application_status} />
      </header>

      {owner.owner_application_status === 'rejected' && owner.owner_rejection_reason && (
        <p className="mt-6 rounded-card border border-hairline bg-card p-5 text-sm leading-relaxed">
          <span className="font-semibold text-danger">Đã từ chối</span>
          {owner.owner_reviewed_at && (
            <span className="text-ink-secondary"> · {dayLabel(new Date(owner.owner_reviewed_at))}</span>
          )}
          <br />
          <span className="text-ink-secondary">Lý do đã gửi cho chủ sân: </span>
          {owner.owner_rejection_reason}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-card border border-hairline bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div>
                <h2 className="font-semibold">Giấy phép kinh doanh</h2>
                <p className="mt-1 text-xs text-ink-secondary">
                  {owner.business_license_name ?? 'Chủ sân chưa tải giấy tờ lên'}
                </p>
              </div>
              {owner.business_license_path && (
                <a href={`/api/admin/owners/${owner.id}/license`} target="_blank" rel="noreferrer"
                  className="rounded-control border border-hairline px-3.5 py-2 text-xs font-semibold text-pitch">
                  Mở ở tab mới ↗
                </a>
              )}
            </div>
            {!owner.business_license_path ? (
              <p className="p-10 text-center text-sm text-ink-secondary">
                Chưa có giấy tờ để đối chiếu. Hồ sơ này không duyệt được cho tới khi chủ sân bổ sung.
              </p>
            ) : signed?.signedUrl ? (
              <LicensePreview src={signed.signedUrl} path={owner.business_license_path} fallbackHref={`/api/admin/owners/${owner.id}/license`} />
            ) : (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Không mở được tệp giấy tờ. Chủ sân đã khai tên tệp nhưng kho lưu trữ không trả về nội dung —
                  nhờ họ tải lại trước khi duyệt.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-card border border-hairline bg-card p-5 sm:p-7">
            <h2 className="font-semibold">Thông tin chủ sân đã khai</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <Info icon={Phone} label="Số điện thoại" value={owner.phone ?? 'Chưa có'} />
              <Info icon={WalletCards} label="Tài khoản nhận cọc"
                value={owner.payout_bank ? `${owner.payout_bank} · ${owner.payout_account ?? 'chưa có số'}` : 'Chưa có'} />
              <Info icon={FileText} label="Tên tệp giấy tờ" value={owner.business_license_name ?? 'Chưa có'} />
              <Info icon={Building2} label="Cụm sân đã đăng ký" value={`${venues?.length ?? 0} cụm`} />
            </dl>
          </section>

          {approved && (
            <section className="rounded-card border border-hairline bg-card p-5 sm:p-7">
              <h2 className="font-semibold">Vận hành thực tế</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat icon={Building2} value={`${(venues ?? []).filter((v) => v.status === 'active').length}/${venues?.length ?? 0}`} label="Cụm sân đang hoạt động" />
                <Stat icon={CalendarCheck} value={String(stats.completed)} label="Đơn đã hoàn tất" />
                <Stat icon={CircleCheck} value={String(stats.confirmed)} label="Đơn đang xác nhận" />
              </div>
              <dl className="mt-5 space-y-3 border-t border-hairline pt-5 text-sm">
                <Metric label="Tổng đơn phát sinh" value={stats.total} />
                <Metric label="Đơn huỷ / không đến" value={stats.cancelled} />
                <Metric label="Sân con" value={stats.courts} />
              </dl>
              {(venues ?? []).length > 0 && (
                <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
                  {venues!.map((venue) => (
                    <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-semibold text-pitch">{venue.name}</p>
                        <p className="mt-1 text-sm text-ink-secondary">{venue.address} · {venue.district}</p>
                      </div>
                      <VenueStatusPill status={venue.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 rounded-card border border-hairline bg-card p-5 sm:p-6 lg:sticky lg:top-6">
          <div>
            <h2 className="font-semibold">{pending ? 'Đối chiếu trước khi duyệt' : 'Hồ sơ đã nộp'}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              {pending
                ? 'So ba mục này với giấy phép bên cạnh. Thiếu mục nào thì chưa duyệt được.'
                : 'Ba mục dưới đây là thứ đã được kiểm khi xử lý hồ sơ.'}
            </p>
          </div>

          <ul className="flex flex-col gap-3 border-t border-hairline pt-4">
            {checks.map((item) => (
              <li key={item.key} className="flex gap-3">
                <span aria-hidden="true" className={`mt-0.5 flex size-5 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                  item.ok ? 'bg-free-fill text-free-ink' : 'bg-danger/10 text-danger'
                }`}>
                  {item.ok ? '✓' : '!'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className={`block break-words text-xs leading-snug ${item.ok ? 'text-ink-secondary' : 'text-danger'}`}>
                    {item.detail}
                  </span>
                  <span className="sr-only">{item.ok ? 'Đủ' : 'Còn thiếu'}</span>
                </span>
              </li>
            ))}
          </ul>

          {pending ? (
            <div className="border-t border-hairline pt-4">
              <OwnerReview ownerId={owner.id} owner={owner} size="page" />
            </div>
          ) : (
            <p className="border-t border-hairline pt-4 text-xs leading-relaxed text-ink-secondary">
              Hồ sơ đã xử lý{owner.owner_reviewed_at ? ` ngày ${dayLabel(new Date(owner.owner_reviewed_at))}` : ''}.
              Không duyệt lại được — chủ sân phải gửi hồ sơ mới.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function OwnerStatus({ status }: { status: OwnerApplicationStatus | null }) {
  const styles: Record<string, string> = {
    pending: 'border-peak-line bg-peak-fill text-peak-ink',
    active: 'border-free-line bg-free-fill text-free-ink',
    rejected: 'border-danger/30 bg-danger/5 text-danger',
  };
  return (
    <span className={`rounded-pill border px-3.5 py-1.5 text-xs font-semibold ${styles[status ?? ''] ?? 'border-hairline bg-sunk text-ink-secondary'}`}>
      {OWNER_STATUS_LABELS[status ?? ''] ?? 'Chưa có trạng thái'}
    </span>
  );
}

function VenueStatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { active: 'Đang hoạt động', pending: 'Chờ duyệt', rejected: 'Bị từ chối', draft: 'Nháp' };
  const styles: Record<string, string> = {
    active: 'border-free-line bg-free-fill text-free-ink',
    pending: 'border-peak-line bg-peak-fill text-peak-ink',
  };
  return (
    <span className={`rounded-pill border px-2.5 py-1 text-xs font-medium ${styles[status] ?? 'border-hairline bg-sunk text-ink-secondary'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Building2; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-hairline p-4">
      <Icon className="size-5 flex-none text-pitch" aria-hidden="true" />
      <span>
        <strong className="block font-display text-xl font-bold text-pitch">{value}</strong>
        <span className="text-xs text-ink-secondary">{label}</span>
      </span>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-secondary" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-ink-secondary">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-pitch">{value}</dd>
    </div>
  );
}
