import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SubscriptionRefresh } from '@/components/subscription-refresh';
import type { OwnerSubscription } from '@/lib/subscriptions';

export async function SubscriptionBanner() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.rpc('get_my_subscription');
  if (error) throw new Error('Chưa kiểm tra được hạn phí sử dụng. Vui lòng tải lại trang.');
  const s = data as OwnerSubscription | null;
  if (!s) return null;
  return <><SubscriptionRefresh ownerId={user.id} paidUntil={s.paid_until} />{s.fee_required && !s.active && <div role="status" className="border-b border-peak-line bg-peak-fill px-5 py-4 text-sm text-peak-ink lg:px-10">Bạn cần thanh toán phí sử dụng 299.000đ/tháng để đăng sân và nhận đơn mới. Đơn đã có vẫn được xử lý. <Link href="/chu-san/phi-dich-vu" className="font-semibold underline underline-offset-4">Thanh toán phí</Link></div>}</>;
}
