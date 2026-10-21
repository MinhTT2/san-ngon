import { z } from 'zod';
import { ownerApplicationEmail, ownerBookingEmail, ownerBookingMessage, sendEmail, sendTelegram } from '@/lib/notify';

const booking = z.object({
  code: z.string(), venue_name: z.string().nullable(), court_name: z.string().nullable(),
  starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }),
  total_amount: z.number(), deposit_amount: z.number(), customer_name: z.string().nullable(), customer_phone: z.string(),
});
const review = z.object({ status: z.enum(['active', 'rejected']), reason: z.string().nullable() });
export type DeliveryJob = {
  id: string; lease_id: string; channel: 'email' | 'telegram'; kind: 'booking' | 'owner_review';
  destination: string; payload: unknown;
};

/** Pure provider dispatch: no database privilege, and no business-state changes. */
export async function deliverNotification(job: DeliveryJob) {
  if (job.kind === 'booking') {
    const result = booking.safeParse(job.payload);
    if (!result.success) return { ok: false, reason: 'INVALID_PAYLOAD' };
    const payload = { ...result.data, ok: true, reason: 'CONFIRMED', venue_name: result.data.venue_name ?? '', court_name: result.data.court_name ?? '' };
    return job.channel === 'telegram'
      ? sendTelegram(job.destination, ownerBookingMessage(payload))
      : sendEmail(job.destination, `Đơn mới ${payload.code} · ${payload.venue_name || 'Sân Ngon'}`, ownerBookingEmail(payload), `notification/${job.id}`);
  }
  const result = review.safeParse(job.payload);
  if (job.kind !== 'owner_review' || job.channel !== 'email' || !result.success) return { ok: false, reason: 'INVALID_PAYLOAD' };
  const email = ownerApplicationEmail(result.data.status, result.data.reason);
  return sendEmail(job.destination, email.subject, email.html, `notification/${job.id}`);
}
