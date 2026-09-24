'use client';

import { useRouter } from 'next/navigation';

type VenueOption = { id: string; name: string };

type Props = {
  venues: VenueOption[];
  selectedId: string;
  pathname: string;
  query?: Record<string, string | undefined>;
};

/**
 * Một ô chọn cố định thay cho dải nút tên cụm sân.
 * URL vẫn là nguồn trạng thái để refresh, link và nút back hoạt động đúng.
 */
export function OwnerVenuePicker({ venues, selectedId, pathname, query = {} }: Props) {
  const router = useRouter();

  if (venues.length < 2) return null;

  function changeVenue(id: string) {
    const params = new URLSearchParams();
    Object.entries({ ...query, venue: id }).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-card px-4 py-3">
      <label htmlFor="owner-venue-picker" className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary">
        Cụm sân đang xem
      </label>
      <select
        id="owner-venue-picker"
        value={selectedId}
        onChange={(event) => changeVenue(event.target.value)}
        className="h-11 min-w-0 flex-1 rounded-control border border-hairline bg-page px-3 text-sm font-semibold text-pitch outline-none focus:border-pitch sm:max-w-md"
        aria-label="Chọn cụm sân"
      >
        {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
      </select>
      <span className="text-xs text-ink-secondary">{venues.length} cụm sân</span>
    </div>
  );
}
