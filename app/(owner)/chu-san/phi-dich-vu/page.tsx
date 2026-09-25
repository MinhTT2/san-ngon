import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import type { OwnerSubscription, SubscriptionInvoice } from '@/lib/subscriptions';
import { PaymentPanel } from './payment-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phí sử dụng website · Sân Ngon' };
export default async function Page() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/phi-dich-vu');
  const { data: profile } = await db.from('profiles').select('role,owner_application_status').eq('id', user.id).single();
  if (!profile || !['owner', 'admin'].includes(profile.role) || profile.owner_application_status !== 'active') redirect('/dang-ky-san');
  const [{ data, error }, history] = await Promise.all([
    db.rpc('get_my_subscription'),
    db.from('subscription_invoices').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(30),
  ]);
  if (error || history.error || !data) throw new Error('Chưa tải được phí sử dụng. Vui lòng thử lại.');
  const s = data as OwnerSubscription;
  const invoices = history.data as SubscriptionInvoice[];
  const pending = invoices.find(i => i.status === 'pending') ?? null;
  return <main className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-10">
    <h1 className="font-display text-4xl font-extrabold tracking-tight text-pitch">Phí sử dụng website</h1>
    <div className="mt-6 rounded-card border border-hairline bg-card p-5 sm:p-8">
      <p className="font-semibold text-pitch">{!s.fee_required ? 'Tài khoản đang được miễn phí' : s.active ? 'Đã thanh toán phí sử dụng' : 'Cần thanh toán để đăng sân và nhận đơn mới'}</p>
      <p className="mt-3 text-sm leading-7 text-ink-secondary">{s.fee_required ? 'Phí 299.000đ/tháng. Khi hết hạn, hệ thống tạm dừng đăng sân và nhận đơn mới; bạn vẫn xem và xử lý các đơn đã có.' : 'Quản trị viên chưa bật thu phí cho tài khoản này. Bạn không cần chuyển tiền.'}</p>
      {s.paid_until && <p className="mt-3 text-sm">Hạn đã thanh toán: <strong>{dayLabel(new Date(s.paid_until))} · {hhmm(s.paid_until)}</strong></p>}
    </div>
    {s.fee_required && <PaymentPanel invoice={pending} />}
    <section className="mt-8"><h2 className="font-display text-2xl font-bold text-pitch">Lịch sử thanh toán</h2>
      {!invoices.some(i => i.status === 'paid') ? <p className="mt-4 text-sm text-ink-secondary">Chưa có kỳ phí đã thanh toán.</p> : <ul className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-card">{invoices.filter(i => i.status === 'paid').map(i => <li key={i.id} className="flex flex-wrap justify-between gap-3 p-5 text-sm"><div><strong>{i.code}</strong><p className="mt-1 text-ink-secondary">Đã nhận {vnd(i.amount)} · {dayLabel(new Date(i.paid_at!))}</p></div><p>Gia hạn đến {dayLabel(new Date(i.period_end!))} · {hhmm(i.period_end!)}</p></li>)}</ul>}
    </section>
  </main>;
}
