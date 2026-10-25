import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverNotification, type DeliveryJob } from '@/lib/notification-delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Scheduler-only worker. Privileged access stays inside /api/sepay as required. */
export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!secret || secret.length < 32 || !timingSafeEqual(createHash('sha256').update(auth).digest(), createHash('sha256').update(`Bearer ${secret}`).digest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc('claim_notification_deliveries', { p_limit: 3 });
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 503 });
  let sent = 0, failed = 0;
  for (const job of (data ?? []) as DeliveryJob[]) {
    let result: { ok: boolean; reason?: string };
    try { result = await deliverNotification(job); }
    catch { result = { ok: false, reason: 'NETWORK' }; }
    const finished = await db.rpc('finish_notification_delivery', {
      p_id: job.id, p_lease_id: job.lease_id, p_ok: result.ok, p_reason: result.reason ?? null,
    });
    // Leave a failed acknowledgement leased; the scheduler can recover it safely.
    if (finished.error || finished.data !== true) return NextResponse.json({ error: 'acknowledgement_failed' }, { status: 503 });
    if (result.ok) sent++; else failed++;
  }
  return NextResponse.json({ sent, failed }, { headers: { 'Cache-Control': 'no-store' } });
}
