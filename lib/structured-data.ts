import { siteUrl } from './site-url';
import { SPORT_LABELS } from './constants';

// Only explicitly public fields enter these projections. Never spread database rows.
export function venueStructuredData(venue: { name: string; address: string; district: string; description: string | null }, slug: string, image?: string | null) {
  return {
    '@context': 'https://schema.org', '@type': 'SportsActivityLocation',
    name: venue.name, url: siteUrl(`/san/${encodeURIComponent(slug)}`).href,
    description: venue.description || undefined,
    address: { '@type': 'PostalAddress', streetAddress: venue.address, addressLocality: venue.district, addressRegion: 'Hà Nội', addressCountry: 'VN' },
    ...(image ? { image } : {}),
  };
}
export function tournamentStructuredData(tournament: { id: string; title: string; sport: string; status: string; moderation_hidden: boolean; starts_at: string; ends_at: string; address: string }, image?: string | null) {
  if (tournament.moderation_hidden || !['published', 'completed'].includes(tournament.status)) return null;
  return {
    '@context': 'https://schema.org', '@type': 'SportsEvent',
    name: tournament.title, sport: SPORT_LABELS[tournament.sport] ?? tournament.sport,
    url: siteUrl(`/giai-dau/${tournament.id}`).href,
    startDate: tournament.starts_at, endDate: tournament.ends_at,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', address: { '@type': 'PostalAddress', streetAddress: tournament.address, addressCountry: 'VN' } },
    ...(image ? { image } : {}),
  };
}
export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
