import { BarChart3, CalendarCheck, CircleDollarSign, Clock3, TrendingUp, Users } from 'lucide-react';
import { vnd } from '@/lib/format';
import type { AdminStats, OwnerStats, StatsPoint } from '@/lib/stats';

export function PeriodLinks({ path, period }: { path: string; period: number }) {
  return <nav aria-label="Khoảng thời gian thống kê" className="flex items-center gap-1 rounded-control border border-hairline bg-card p-1 text-xs font-semibold">
    {[7, 30, 90].map((days) => <a key={days} href={`${path}?period=${days}`} className={`rounded-control px-3 py-2 ${period === days ? 'bg-pitch text-pitch-ink' : 'text-ink-secondary hover:bg-sunk'}`}>{days} ngày</a>)}
  </nav>;
}

export function OwnerStatsPanel({ stats }: { stats: OwnerStats }) {
  const s = stats.summary;
  return <section className="mt-8" aria-labelledby="stats-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Hiệu quả kinh doanh</p><h2 id="stats-heading" className="mt-1 font-display text-2xl font-bold text-pitch">Thống kê {stats.from} → {stats.to}</h2></div><span className="text-xs text-ink-secondary">Đơn đã thanh toán mới tính vào doanh thu</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Stat icon={CircleDollarSign} value={vnd(s.revenue)} label="Doanh thu sân" />
      <Stat icon={CircleDollarSign} value={vnd(s.deposit)} label="Tiền cọc đã nhận" />
      <Stat icon={CalendarCheck} value={String(s.paid_bookings)} label="Đơn đã chốt" />
      <Stat icon={Clock3} value={`${s.occupancy_pct}%`} label={`Lấp đầy · ${s.booked_hours}/${s.capacity_hours} giờ`} />
      <Stat icon={TrendingUp} value={`${s.cancellation_pct}%`} label={`${s.cancelled} đơn hủy / không đến`} tone={s.cancellation_pct > 10 ? 'danger' : undefined} />
      <Stat icon={BarChart3} value={String(s.pending)} label="Đơn đang chờ cọc" tone={s.pending ? 'peak' : undefined} />
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <RevenueChart points={stats.daily} />
      <CourtRanking courts={stats.courts} />
    </div>
  </section>;
}

export function AdminStatsPanel({ stats }: { stats: AdminStats }) {
  const s = stats.summary;
  return <section className="mt-8" aria-labelledby="stats-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Sức khỏe nền tảng</p><h2 id="stats-heading" className="mt-1 font-display text-2xl font-bold text-pitch">Thống kê {stats.from} → {stats.to}</h2></div><span className="text-xs text-ink-secondary">Chỉ tính cụm sân đang hoạt động</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Stat icon={CircleDollarSign} value={vnd(s.revenue)} label="Giá trị đơn đã chốt" />
      <Stat icon={CircleDollarSign} value={vnd(s.deposit)} label="Tiền cọc qua hệ thống" />
      <Stat icon={CalendarCheck} value={String(s.paid_bookings)} label={`Đơn đã chốt / ${s.bookings} phát sinh`} />
      <Stat icon={Clock3} value={`${s.occupancy_pct}%`} label={`Lấp đầy · ${s.booked_hours}/${s.capacity_hours} giờ`} />
      <Stat icon={Users} value={`+${s.new_players}`} label={`Người chơi mới · ${s.players} tài khoản`} />
      <Stat icon={TrendingUp} value={`${s.active_venues} cụm · ${s.active_courts} sân`} label="Đang hoạt động" />
    </div>
    {(s.pending_owners + s.pending_venues + s.pending_bookings) > 0 && <p className="mt-4 rounded-card border border-peak-line bg-peak-fill px-4 py-3 text-sm text-peak-ink">Cần xử lý: {s.pending_owners} hồ sơ chủ sân, {s.pending_venues} hồ sơ cụm sân, {s.pending_bookings} đơn chờ cọc.</p>}
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <RevenueChart points={stats.daily} />
      <VenueRanking venues={stats.venues} />
    </div>
  </section>;
}

function Stat({ icon: Icon, value, label, tone }: { icon: typeof BarChart3; value: string; label: string; tone?: 'danger' | 'peak' }) {
  return <div className="flex min-h-[94px] flex-col justify-between rounded-card border border-hairline bg-card p-4"><Icon className={`size-5 ${tone === 'danger' ? 'text-danger' : tone === 'peak' ? 'text-peak-ink' : 'text-pitch'}`} aria-hidden="true" /><strong className={`font-display text-xl font-bold ${tone === 'danger' ? 'text-danger' : tone === 'peak' ? 'text-peak-ink' : 'text-pitch'}`}>{value}</strong><span className="text-[11px] leading-tight text-ink-secondary">{label}</span></div>;
}

function RevenueChart({ points }: { points: StatsPoint[] }) {
  const max = Math.max(...points.map((point) => point.revenue), 1);
  return <section className="rounded-card border border-hairline bg-card p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Doanh thu theo ngày</h3><p className="mt-1 text-xs text-ink-secondary">Nhìn ra ngày cao điểm để xếp lịch và điều chỉnh giá.</p></div><span className="text-xs text-ink-secondary">{vnd(max)} đỉnh</span></div><div className="mt-6 flex h-44 items-end gap-1 border-b border-hairline pb-0">{points.map((point) => <div key={point.date} className="group flex h-full flex-1 items-end" title={`${point.date}: ${vnd(point.revenue)}`}><div className="w-full rounded-t-sm bg-pitch transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(point.revenue ? 5 : 1, point.revenue / max * 100)}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-ink-secondary"><span>{points[0]?.date ?? '—'}</span><span>{points.at(-1)?.date ?? '—'}</span></div></section>;
}

function CourtRanking({ courts }: { courts: OwnerStats['courts'] }) {
  return <section className="rounded-card border border-hairline bg-card p-5"><h3 className="font-semibold">Hiệu suất từng sân</h3><p className="mt-1 text-xs text-ink-secondary">Sân đứng đầu theo số giờ đã bán.</p>{courts.length ? <div className="mt-4 divide-y divide-hairline">{courts.map((court, index) => <div key={court.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="w-5 text-sm font-semibold text-ink-secondary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{court.name}</p><p className="mt-1 text-xs text-ink-secondary">{court.bookings} đơn · {court.hours} giờ</p></div><span className="text-right text-xs font-semibold tabular-nums text-pitch">{vnd(court.revenue)}</span></div>)}</div> : <p className="mt-5 text-sm text-ink-secondary">Chưa có dữ liệu.</p>}</section>;
}

function VenueRanking({ venues }: { venues: AdminStats['venues'] }) {
  return <section className="rounded-card border border-hairline bg-card p-5"><h3 className="font-semibold">Cụm sân dẫn đầu</h3><p className="mt-1 text-xs text-ink-secondary">Xếp theo giá trị đơn đã chốt trong kỳ.</p>{venues.length ? <div className="mt-4 divide-y divide-hairline">{venues.map((venue, index) => <div key={`${venue.name}-${venue.district}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="w-5 text-sm font-semibold text-ink-secondary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{venue.name}</p><p className="mt-1 text-xs text-ink-secondary">{venue.district} · {venue.bookings} đơn</p></div><span className="text-right text-xs font-semibold tabular-nums text-pitch">{vnd(venue.revenue)}</span></div>)}</div> : <p className="mt-5 text-sm text-ink-secondary">Chưa có dữ liệu.</p>}</section>;
}
