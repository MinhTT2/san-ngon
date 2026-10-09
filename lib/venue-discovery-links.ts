import { DISTRICTS } from './constants';
import { VenueSearchParams } from './search-params';

/** Only local discovery pages can be used as a venue's return destination. */
export function venueDiscoveryReturn(raw?: string, date?: string): string | null {
  if (!raw?.startsWith('/') || raw.startsWith('//')) return null;
  try {
    const url = new URL(raw, 'https://san-ngon.invalid');
    if (url.origin !== 'https://san-ngon.invalid') return null;
    if (url.pathname === '/san-yeu-thich') return '/san-yeu-thich';
    if (url.pathname !== '/tim-san') return null;
    const filters = VenueSearchParams.parse(Object.fromEntries(url.searchParams));
    const query = new URLSearchParams();
    const values = {
      q: filters.q, sport: filters.sport, ngay: date ?? filters.ngay,
      district: filters.district && DISTRICTS.includes(filters.district) ? filters.district : undefined,
      indoor: filters.indoor, available: filters.available,
      gio: filters.gio, phut: filters.phut,
      sort: filters.sort !== 'name' ? filters.sort : undefined,
      page: filters.page > 1 ? String(filters.page) : undefined,
    };
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
    return `/tim-san${query.size ? `?${query}` : ''}#ket-qua`;
  } catch { return null; }
}
