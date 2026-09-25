import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingList, type MyBooking } from './booking-list';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/don-cua-toi');

  const { data, error } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, status, total_amount, deposit_amount, expires_at, paid_at, refund_status, courts(name, sport, venues(name, district))')
    .eq('user_id', user.id)
    .order('starts_at', { ascending: false });

  return <BookingList bookings={(data ?? []) as unknown as MyBooking[]} userId={user.id} initialNow={Date.now()} failed={Boolean(error)} />;
}
