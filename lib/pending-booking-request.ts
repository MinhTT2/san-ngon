import { z } from 'zod';

export const PENDING_BOOKING_KEY = 'san-ngon:pending-booking-request';
export const BOOKING_REQUEST_EVENT = 'san-ngon:booking-request';
const PendingRequest = z.object({
  userId: z.string().uuid(),
  body: z.object({
    request_user_id: z.string().uuid().optional(),
    request_id: z.string().uuid(), court_id: z.string().uuid(),
    starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }),
    customer_name: z.string().max(100).optional(), customer_phone: z.string().regex(/^0[0-9]{9}$/),
    note: z.string().max(500).optional(),
  }),
});
export type PendingBookingRequest = z.infer<typeof PendingRequest>;

export function readPendingBookingRequest(userId: string): PendingBookingRequest | null {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return null;
    const parsed = PendingRequest.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.userId !== userId) {
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

export function savePendingBookingRequest(request: PendingBookingRequest) {
  try { sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(request)); } catch { /* The form still keeps the key in memory. */ }
}

export function clearPendingBookingRequest(requestId: string) {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (raw && JSON.parse(raw).body?.request_id === requestId) sessionStorage.removeItem(PENDING_BOOKING_KEY);
  } catch { /* Blocked storage must not prevent opening the server-created booking. */ }
  window.dispatchEvent(new Event(BOOKING_REQUEST_EVENT));
}
