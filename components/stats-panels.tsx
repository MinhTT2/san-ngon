import { Activity, ArrowUpRight, BarChart3, CalendarCheck, Clock3, Target, TrendingUp, Users } from 'lucide-react';
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
    <StatsHeader eyebrow="Hiệu quả kinh doanh" from={stats.from} to={stats.to} />
    <div className="mt-4 overflow-hidden rounded-card border border-pitch bg-pitch text-pitch-ink">
      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_190px] lg:p-8">
        <div className="flex min-w-0 flex-col justify-between gap-8"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-strong"><Activity className="size-4" aria-hidden="true" /> Đang hoạt động</div><p className="mt-5 text-sm text-strong">Giá trị đơn đã chốt trong kỳ</p><p className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{vnd(s.revenue)}</p><p className="mt-3 max-w-md text-sm leading-6 text-strong">Tiền cọc đã nhận <strong className="text-pitch-ink">{vnd(s.deposit)}</strong>. Chỉ tính đơn đã xác nhận thanh toán.</p></div><div className="flex flex-wrap gap-2 text-xs"><DarkPill label="Đơn đã chốt" value={s.paid_bookings} /><DarkPill label="Giờ đã bán" value={`${s.booked_hours}h`} /><DarkPill label="Đơn chờ cọc" value={s.pending} /></div></div>
        <OccupancyRing value={s.occupancy_pct} booked={s.booked_hours} capacity={s.capacity_hours} />
      </div>
      <div className="grid border-t border-white/15 sm:grid-cols-3"><HeroMetric label="Tỷ lệ lấp đầy" value={`${s.occupancy_pct}%`} icon={Target} /><HeroMetric label="Tỷ lệ hủy / không đến" value={`${s.cancellation_pct}%`} icon={TrendingUp} danger={s.cancellation_pct > 10} /><HeroMetric label="Số đơn phát sinh" value={s.bookings} icon={CalendarCheck} /></div>
    </div>
    <div className="mt-4"><OwnerActions pending={s.pending} cancelled={s.cancelled} /></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]"><RevenueChart points={stats.daily} /><CourtRanking courts={stats.courts} /></div>
  </section>;
}

export function AdminStatsPanel({ stats }: { stats: AdminStats }) {
  const s = stats.summary;
  return <section className="mt-8" aria-labelledby="stats-heading">
    <StatsHeader eyebrow="Sức khỏe nền tảng" from={stats.from} to={stats.to} suffix="Chỉ tính cụm sân đang hoạt động" />
    <div className="mt-4 overflow-hidden rounded-card border border-pitch bg-pitch text-pitch-ink">
      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_190px] lg:p-8"><div className="flex min-w-0 flex-col justify-between gap-8"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-strong"><Activity className="size-4" aria-hidden="true" /> Đang hoạt động</div><p className="mt-5 text-sm text-strong">Giá trị giao dịch đã chốt</p><p className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{vnd(s.revenue)}</p><p className="mt-3 max-w-md text-sm leading-6 text-strong">Tiền cọc qua hệ thống <strong className="text-pitch-ink">{vnd(s.deposit)}</strong> từ {s.paid_bookings} đơn đã thanh toán.</p></div><div className="flex flex-wrap gap-2 text-xs"><DarkPill label="Người chơi mới" value={`+${s.new_players}`} /><DarkPill label="Cụm sân" value={s.active_venues} /><DarkPill label="Sân hoạt động" value={s.active_courts} /></div></div><OccupancyRing value={s.occupancy_pct} booked={s.booked_hours} capacity={s.capacity_hours} /></div>
      <div className="grid border-t border-white/15 sm:grid-cols-3"><HeroMetric label="Tỷ lệ lấp đầy" value={`${s.occupancy_pct}%`} icon={Target} /><HeroMetric label="Đơn đã chốt" value={`${s.paid_bookings}/${s.bookings}`} icon={CalendarCheck} /><HeroMetric label="Đang hoạt động" value={`${s.active_venues} cụm`} icon={TrendingUp} /></div>
    </div>
    {(s.pending_owners + s.pending_venues + s.pending_bookings) > 0 && <div className="mt-4 rounded-card border border-peak-line bg-peak-fill p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-peak-ink">Cần xử lý</p><p className="mt-1 font-semibold text-peak-ink">Có việc đang chờ trên hệ thống</p><p className="mt-1 text-sm text-peak-ink">{s.pending_owners} hồ sơ chủ sân · {s.pending_venues} hồ sơ cụm sân · {s.pending_bookings} đơn chờ cọc</p></div><ArrowUpRight className="size-5 text-peak-ink" aria-hidden="true" /></div></div>}
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]"><RevenueChart points={stats.daily} /><VenueRanking venues={stats.venues} /></div>
  </section>;
}

function StatsHeader({ eyebrow, from, to, suffix = 'Đơn đã thanh toán mới tính vào doanh thu' }: { eyebrow: string; from: string; to: string; suffix?: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">{eyebrow}</p><h2 id="stats-heading" className="mt-1 font-display text-3xl font-extrabold tracking-tight text-pitch">Bức tranh vận hành</h2></div><div className="text-right text-xs text-ink-secondary"><p>{from} → {to}</p><p className="mt-1">{suffix}</p></div></div>;
}

function DarkPill({ label, value }: { label: string; value: number | string }) {
  return <span className="rounded-pill border border-white/15 bg-white/10 px-3 py-2 text-strong"><strong className="text-pitch-ink">{value}</strong> {label}</span>;
}

function HeroMetric({ label, value, icon: Icon, danger }: { label: string; value: string | number; icon: typeof Target; danger?: boolean }) {
  return <div className="flex items-center gap-3 px-6 py-4 lg:px-8"><Icon className={`size-4 ${danger ? 'text-[#F4B3A8]' : 'text-strong'}`} aria-hidden="true" /><span><strong className={`block text-sm ${danger ? 'text-[#F4B3A8]' : 'text-pitch-ink'}`}>{value}</strong><span className="text-[11px] text-strong">{label}</span></span></div>;
}

function OccupancyRing({ value, booked, capacity }: { value: number; booked: number; capacity: number }) {
  const safe = Math.min(100, Math.max(0, value));
  return <div className="flex items-center justify-center"><div className="relative flex size-40 items-center justify-center rounded-full" style={{ background: `conic-gradient(#9FC6B2 ${safe}%, rgba(255,255,255,.12) ${safe}% 100%)` }}><div className="flex size-[124px] flex-col items-center justify-center rounded-full bg-pitch text-center"><strong className="font-display text-3xl font-extrabold">{value}%</strong><span className="mt-1 text-[11px] text-strong">lấp đầy</span><span className="mt-1 text-[10px] text-strong">{booked}/{capacity} giờ</span></div></div></div>;
}

function OwnerActions({ pending, cancelled }: { pending: number; cancelled: number }) {
  return <div className="grid gap-3 sm:grid-cols-2"><div className={`flex items-center gap-3 rounded-card border p-4 ${pending ? 'border-peak-line bg-peak-fill' : 'border-hairline bg-card'}`}><Clock3 className={`size-5 ${pending ? 'text-peak-ink' : 'text-ink-secondary'}`} aria-hidden="true" /><div><p className="text-sm font-semibold">{pending ? `${pending} đơn cần theo dõi` : 'Không có đơn chờ cọc'}</p><p className="mt-1 text-xs text-ink-secondary">{pending ? 'Mở lịch 7 ngày tới để kiểm tra các khung giờ sắp bắt đầu.' : 'Các đơn trong kỳ đã được xử lý.'}</p></div></div><div className="flex items-center gap-3 rounded-card border border-hairline bg-card p-4"><BarChart3 className="size-5 text-pitch" aria-hidden="true" /><div><p className="text-sm font-semibold">{cancelled ? `${cancelled} đơn hủy hoặc không đến` : 'Không có đơn hủy'}</p><p className="mt-1 text-xs text-ink-secondary">Theo dõi chỉ số này để điều chỉnh chính sách cọc.</p></div></div></div>;
}

function RevenueChart({ points }: { points: StatsPoint[] }) {
  const max = Math.max(...points.map((point) => point.revenue), 1);
  return <section className="rounded-card border border-hairline bg-card p-5 lg:p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><BarChart3 className="size-4 text-pitch" aria-hidden="true" /><h3 className="font-semibold">Doanh thu theo ngày</h3></div><p className="mt-1 text-xs text-ink-secondary">Nhìn ra ngày cao điểm để xếp lịch và điều chỉnh giá.</p></div><span className="rounded-pill bg-free-fill px-2.5 py-1 text-[11px] font-semibold text-free-ink">Đỉnh {vnd(max)}</span></div><div className="mt-7 flex h-48 items-end gap-1.5 border-b border-hairline">{points.map((point) => <div key={point.date} className="group relative flex h-full flex-1 items-end" title={`${point.date}: ${vnd(point.revenue)}`}><div className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-control bg-ink px-2 py-1 text-[10px] text-pitch-ink group-hover:block">{vnd(point.revenue)}</div><div className="w-full rounded-t-slot bg-pitch transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(point.revenue ? 5 : 1, point.revenue / max * 100)}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-ink-secondary"><span>{points[0]?.date ?? '—'}</span><span>{points.at(-1)?.date ?? '—'}</span></div></section>;
}

function CourtRanking({ courts }: { courts: OwnerStats['courts'] }) {
  const max = Math.max(...courts.map((court) => court.hours), 1);
  return <section className="rounded-card border border-hairline bg-card p-5 lg:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Hiệu suất từng sân</h3><p className="mt-1 text-xs text-ink-secondary">Sân đứng đầu theo số giờ đã bán.</p></div><Target className="size-5 text-pitch" aria-hidden="true" /></div>{courts.length ? <div className="mt-5 space-y-4">{courts.map((court, index) => <div key={court.name}><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{index + 1}. {court.name}</span><span className="shrink-0 text-xs tabular-nums text-ink-secondary">{court.hours} giờ · {vnd(court.revenue)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-pill bg-sunk"><div className="h-full rounded-pill bg-pitch" style={{ width: `${Math.max(4, court.hours / max * 100)}%` }} /></div></div>)}</div> : <p className="mt-5 text-sm text-ink-secondary">Chưa có dữ liệu.</p>}</section>;
}

function VenueRanking({ venues }: { venues: AdminStats['venues'] }) {
  return <section className="rounded-card border border-hairline bg-card p-5 lg:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Cụm sân dẫn đầu</h3><p className="mt-1 text-xs text-ink-secondary">Xếp theo giá trị đơn đã chốt trong kỳ.</p></div><Users className="size-5 text-pitch" aria-hidden="true" /></div>{venues.length ? <div className="mt-4 divide-y divide-hairline">{venues.map((venue, index) => <div key={`${venue.name}-${venue.district}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-7 items-center justify-center rounded-pill bg-sunk text-xs font-semibold text-ink-secondary">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{venue.name}</p><p className="mt-1 text-xs text-ink-secondary">{venue.district} · {venue.bookings} đơn</p></div><span className="text-right text-xs font-semibold tabular-nums text-pitch">{vnd(venue.revenue)}</span></div>)}</div> : <p className="mt-5 text-sm text-ink-secondary">Chưa có dữ liệu.</p>}</section>;
}
