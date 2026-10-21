import { SPORT_LABELS } from '@/lib/constants';

export type TournamentFilters = { q: string; location: string; sport: string; status: string; sort: string; layout: string };
export function tournamentFilters(raw: Record<string, string | string[] | undefined>): TournamentFilters {
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]));
  return {
    q: (params.q ?? '').trim().slice(0, 100),
    location: (params.location ?? '').trim().slice(0, 100),
    sport: Object.hasOwn(SPORT_LABELS, params.sport ?? '') ? params.sport! : '',
    status: ['open', 'upcoming', 'ongoing', 'completed'].includes(params.status ?? '') ? params.status! : '',
    sort: ['newest', 'fee'].includes(params.sort ?? '') ? params.sort! : 'soonest',
    layout: params.layout === 'list' ? 'list' : 'grid',
  };
}
/** Treat the user's text literally rather than as SQL wildcard characters. */
export const tournamentSearchPattern = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;