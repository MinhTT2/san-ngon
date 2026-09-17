import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PaymentPanel } from './payment-panel';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, code, starts_at, ends_at, total_amount, deposit_amount, status, expires_at, courts(name, venues(name, address))')
    .eq('code', code)
    .single();

  if (!booking) notFound();

  const court = booking.courts as unknown as { name: string; venues: { name: string; address: string } };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <PaymentPanel
        bookingId={booking.id}
        code={booking.code}
        status={booking.status}
        startsAt={booking.starts_at}
        endsAt={booking.ends_at}
        expiresAt={booking.expires_at}
        total={booking.total_amount}
        deposit={booking.deposit_amount}
        courtName={court?.name ?? ''}
        venueName={court?.venues?.name ?? ''}
        venueAddress={court?.venues?.address ?? ''}
      />
    </main>
  );
}
