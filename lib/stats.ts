export type StatsPoint = { date: string; bookings: number; revenue: number };
export type CourtStat = { name: string; bookings: number; revenue: number; hours: number };
export type VenueStat = { name: string; district: string; bookings: number; revenue: number };

export type OwnerStats = {
  from: string;
  to: string;
  summary: {
    bookings: number;
    paid_bookings: number;
    revenue: number;
    deposit: number;
    cancelled: number;
    pending: number;
    capacity_hours: number;
    booked_hours: number;
    occupancy_pct: number;
    cancellation_pct: number;
  };
  daily: StatsPoint[];
  courts: CourtStat[];
};

export type AdminStats = {
  from: string;
  to: string;
  summary: OwnerStats['summary'] & {
    active_venues: number;
    active_courts: number;
    players: number;
    owners: number;
    new_players: number;
    pending_bookings: number;
    pending_owners: number;
    pending_venues: number;
  };
  daily: StatsPoint[];
  venues: VenueStat[];
};

const n = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const text = (value: unknown) => typeof value === 'string' ? value : '';

function points(value: unknown): StatsPoint[] {
  return Array.isArray(value) ? value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { date: text(row.date), bookings: n(row.bookings), revenue: n(row.revenue) };
  }) : [];
}

export function parseOwnerStats(value: unknown): OwnerStats {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const raw = row.summary && typeof row.summary === 'object' ? row.summary as Record<string, unknown> : {};
  return {
    from: text(row.from), to: text(row.to),
    summary: {
      bookings: n(raw.bookings), paid_bookings: n(raw.paid_bookings), revenue: n(raw.revenue), deposit: n(raw.deposit),
      cancelled: n(raw.cancelled), pending: n(raw.pending), capacity_hours: n(raw.capacity_hours), booked_hours: n(raw.booked_hours),
      occupancy_pct: n(raw.occupancy_pct), cancellation_pct: n(raw.cancellation_pct),
    },
    daily: points(row.daily),
    courts: Array.isArray(row.courts) ? row.courts.map((item) => {
      const court = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: text(court.name), bookings: n(court.bookings), revenue: n(court.revenue), hours: n(court.hours) };
    }) : [],
  };
}

export function parseAdminStats(value: unknown): AdminStats {
  const owner = parseOwnerStats(value);
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const raw = row.summary && typeof row.summary === 'object' ? row.summary as Record<string, unknown> : {};
  return {
    ...owner,
    summary: {
      ...owner.summary,
      active_venues: n(raw.active_venues), active_courts: n(raw.active_courts), players: n(raw.players), owners: n(raw.owners),
      new_players: n(raw.new_players), pending_bookings: n(raw.pending_bookings), pending_owners: n(raw.pending_owners), pending_venues: n(raw.pending_venues),
    },
    venues: Array.isArray(row.venues) ? row.venues.map((item) => {
      const venue = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: text(venue.name), district: text(venue.district), bookings: n(venue.bookings), revenue: n(venue.revenue) };
    }) : [],
  };
}
