import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { OwnerSubscription } from '@/lib/subscriptions';

export async function OwnerReadiness({ venueId }: { venueId?: string }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const [profile, venue, fee, receiver, accepts] = await Promise.all([
    db.from('profiles').select('owner_application_status').eq('id',user.id).maybeSingle(),
    venueId ? db.from('venues').select('status,images,courts(id,is_active)').eq('id',venueId).eq('owner_id',user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.rpc('get_my_subscription'), db.rpc('get_my_sepay_connection'),
    venueId ? db.rpc('venue_accepts_bookings',{ p_venue_id: venueId }) : Promise.resolve({ data: false, error: null }),
  ]);
  const subscription = fee.data as OwnerSubscription | null;
  const connection = receiver.data as { status?: string; rollout_enabled?: boolean } | null;
  const steps: { label: string; ok: boolean | null; href: string }[] = [
    { label: 'Hồ sơ chủ sân đã được duyệt', ok: profile.error ? null : profile.data?.owner_application_status==='active', href:'/dang-ky-san' },
    { label: 'Cụm sân có 3–8 ảnh đã lưu', ok: venue.error ? null : !!venue.data && (venue.data.images ?? []).length>=3 && (venue.data.images ?? []).length<=8, href:'/chu-san/quan-ly' },
    { label: 'Có sân con đang hoạt động', ok: venue.error ? null : !!venue.data?.courts.some(court => court.is_active), href:'/chu-san/quan-ly' },
    { label: 'Tài khoản nhận cọc sẵn sàng', ok: receiver.error || accepts.error ? null : connection?.status==='ready' || accepts.data===true, href:'/chu-san/thanh-toan' },
    { label: 'Phí sử dụng còn hiệu lực hoặc được miễn', ok: fee.error || !subscription ? null : !subscription.fee_required || subscription.active, href:'/chu-san/phi-dich-vu' },
    { label: 'Hệ thống đã mở nhận đơn cho cụm sân', ok: accepts.error ? null : accepts.data===true && venue.data?.status==='active', href:'/chu-san/thanh-toan' },
  ];
  const ready = steps.every(step => step.ok===true);
  return <details open={!ready} className="mt-5 rounded-card border border-hairline bg-card px-4"><summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-pitch">Chuẩn bị nhận đặt<span className="text-xs text-ink-secondary">{steps.filter(step => step.ok===true).length}/{steps.length} mục</span></summary><ul className="grid gap-2 border-t border-hairline py-4 sm:grid-cols-2">{steps.map(step => <li key={step.label} className="flex items-start gap-2 text-sm leading-6"><span aria-label={step.ok===null ? 'Chưa kiểm tra được' : step.ok ? 'Đã đạt' : 'Cần xử lý'} className="mt-1 text-pitch">{step.ok ? '✓' : '○'}</span><div><Link href={step.href} className="inline-flex min-h-11 items-center font-medium text-pitch underline underline-offset-4">{step.label}</Link>{step.ok===null && <p className="text-xs text-ink-secondary">Chưa tải được trạng thái. Hãy thử lại.</p>}</div></li>)}</ul>{!ready && <p className="border-t border-hairline py-3 text-xs leading-6 text-ink-secondary">Hoàn thiện mục còn thiếu rồi kiểm tra lại. Kết nối nhận cọc không tự duyệt hồ sơ hoặc tự mở quyền nhận đơn.</p>}</details>;
}
