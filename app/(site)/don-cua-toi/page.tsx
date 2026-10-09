import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingRequestRecovery } from '@/components/booking-request-recovery';
import { BookingList, type MyBooking } from './booking-list';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 100) : '';
  const filter = typeof params.filter === 'string' && ['active','pending','confirmed','history','all'].includes(params.filter) ? params.filter : '';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(`/don-cua-toi?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(filter ? { filter } : {}) })}`)}`);

  const { data, error } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, status, total_amount, deposit_amount, expires_at, paid_at, refund_status, courts(name, sport, venues(name, district, slug, status))')
    .eq('user_id', user.id)
    .order('starts_at', { ascending: false });

  return <><BookingRequestRecovery userId={user.id} /><BookingList bookings={(data ?? []) as unknown as MyBooking[]} userId={user.id} initialNow={Date.now()} failed={Boolean(error)} /></>;
}
