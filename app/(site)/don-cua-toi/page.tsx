import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingRequestRecovery } from '@/components/booking-request-recovery';
import { BookingList, type MyBooking } from './booking-list';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 100) : '';
  const filter = typeof params.filter === 'string' && ['active','pending','confirmed','history','all'].includes(params.filter) ? params.filter : 'active';
  const from = typeof params.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : '';
  const to = typeof params.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : '';
  const page = typeof params.page === 'string' && /^\d{1,9}$/.test(params.page) ? Math.max(1,Number(params.page)) : 1;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(`/don-cua-toi?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(filter ? { filter } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`)}`);

  const { data, error } = await supabase.rpc('search_my_bookings', {
    p_query: query || null, p_filter: filter, p_page: page, p_from: from || null, p_to: to || null,
  });
  type Result = { rows: MyBooking[]; total: number; pending: number; confirmed: number; history: number; matched: number; page: number; pages: number; page_size: number; now_ms: number };
  const result = !error && data && Array.isArray(data.rows) ? data as Result : null;
  return <><BookingRequestRecovery userId={user.id} /><BookingList bookings={result?.rows ?? []} userId={user.id} initialNow={result?.now_ms ?? Date.now()} failed={!result} summary={result ?? undefined} invalidRange={Boolean(error?.message.includes('INVALID_DATE_RANGE') || error?.code === '22008' || error?.code === '22007')} /></>;
}
