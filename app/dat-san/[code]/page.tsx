import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PaymentPanel } from './payment-panel';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, total_amount, deposit_amount, status, expires_at, payment_bank, payment_account, payment_account_name, courts(name, venues(name, address))')
    .eq('code', code)
    .single();

  if (!booking) notFound();

  const court = booking.courts as unknown as { name: string; venues: { name: string; address: string } };

  return (
    <PaymentPanel
      bookingId={booking.id}
      bank={booking.payment_bank ?? ''}
      account={booking.payment_account ?? ''}
      accountName={booking.payment_account_name ?? ''}
      code={booking.code}
      status={booking.status}
      startsAt={booking.starts_at}
      endsAt={booking.ends_at}
      expiresAt={booking.expires_at}
      initialSeconds={Math.floor((new Date(booking.expires_at).getTime() - Date.now()) / 1000)}
      total={booking.total_amount}
      deposit={booking.deposit_amount}
      courtName={court?.name ?? ''}
      venueName={court?.venues?.name ?? ''}
      venueAddress={court?.venues?.address ?? ''}
    />
  );
}
