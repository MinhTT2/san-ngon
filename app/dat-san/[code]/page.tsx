import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PaymentPanel } from './payment-panel';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, original_amount, vip_discount_amount, total_amount, deposit_amount, status, expires_at, cancel_window_hours, refund_working_days, cancellation_policy_version, payment_bank, payment_account, payment_account_name, court_name_snapshot, venue_name_snapshot, venue_address_snapshot, courts(name, venues(name, address))')
    .eq('code', code)
    .single();

  if (!booking) notFound();

  const court = booking.courts as unknown as { name: string; venues: { name: string; address: string } };

  return (
    <PaymentPanel
      policy={{ cancel_window_hours: booking.cancel_window_hours, refund_working_days: booking.refund_working_days, cancellation_policy_version: booking.cancellation_policy_version }}
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
      originalAmount={booking.original_amount}
      vipDiscountAmount={booking.vip_discount_amount}
      total={booking.total_amount}
      deposit={booking.deposit_amount}
      courtName={booking.court_name_snapshot ?? court?.name ?? ''}
      venueName={booking.venue_name_snapshot ?? court?.venues?.name ?? ''}
      venueAddress={booking.venue_address_snapshot ?? court?.venues?.address ?? ''}
    />
  );
}
