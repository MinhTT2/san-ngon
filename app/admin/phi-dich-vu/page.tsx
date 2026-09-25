import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dayLabel, hhmm, vnd } from '@/lib/format';
import { FeeControl } from './fee-control';
import type { OwnerSubscription, SubscriptionInvoice } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phí chủ sân · Quản trị Sân Ngon' };
type Owner = OwnerSubscription & { full_name: string | null; phone: string | null };
type Receipt = { transaction_key: string; invoice_id: string; amount: number; created_at: string; outcome: string; subscription_invoices: { code: string; owner_id: string } };
const OUTCOMES: Record<string, string> = { paid: 'Đủ phí', underpaid: 'Thiếu tiền · cần đối soát', overpaid: 'Thừa tiền · cần đối soát', duplicate_payment: 'Chuyển trùng kỳ phí · cần đối soát' };
export default async function Page() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/phi-dich-vu');
  const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');
  const [owners, receiver, invoices, receipts] = await Promise.all([
    db.rpc('get_admin_subscriptions'),
    db.from('subscription_receiver').select('bank,account_number,account_name').maybeSingle(),
    db.from('subscription_invoices').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('subscription_payment_events').select('transaction_key,invoice_id,amount,created_at,outcome,subscription_invoices(code,owner_id)').order('created_at', { ascending: false }).limit(30),
  ]);
  if (owners.error || receiver.error || invoices.error || receipts.error) throw new Error('Chưa tải được phí chủ sân. Vui lòng thử lại.');
  const rows = owners.data as Owner[];
  const names = new Map(rows.map(o => [o.owner_id, o.full_name ?? 'Chủ sân']));
  return <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
    <h1 className="font-display text-3xl font-extrabold text-pitch">Phí sử dụng của chủ sân</h1>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-secondary">Chọn tài khoản phải đóng 299.000đ/tháng. Chưa bật thu phí thì được miễn phí. Khi hết hạn, chủ sân không đăng sân hoặc nhận đơn mới; đơn đã có vẫn được xử lý.</p>
    <section className="mt-6 rounded-card border border-hairline bg-card p-5"><h2 className="font-semibold">Tài khoản nhận phí website</h2><p className="mt-2 text-sm text-ink-secondary">{receiver.data ? `${receiver.data.bank} · ${receiver.data.account_number} · ${receiver.data.account_name}` : 'Chưa cấu hình tài khoản nhận phí.'}</p><p className="mt-2 text-xs leading-6 text-ink-secondary">SePay tự xác nhận theo mã PHI riêng của mỗi kỳ. Phí website không thay đổi tài khoản nhận cọc của chủ sân.</p></section>
    <section className="mt-6 divide-y divide-hairline rounded-card border border-hairline bg-card">
      {rows.length === 0 && <p className="p-6 text-sm text-ink-secondary">Chưa có chủ sân được duyệt.</p>}
      {rows.map(o => <div key={o.owner_id} className="flex flex-wrap items-start justify-between gap-5 p-5"><div><Link href={`/admin/owners/${o.owner_id}`} className="font-semibold text-pitch underline-offset-4 hover:underline">{o.full_name ?? 'Chưa có tên'}</Link><p className="mt-1 text-xs text-ink-secondary">{o.phone ?? 'Chưa có số điện thoại'}</p><p className="mt-3 text-sm font-semibold">{!o.fee_required ? 'Miễn phí' : o.active ? 'Đã đóng phí' : 'Chưa đóng hoặc đã hết hạn'}</p>{o.paid_until && <p className="mt-1 text-xs text-ink-secondary">Hạn đã thanh toán: {dayLabel(new Date(o.paid_until))} · {hhmm(o.paid_until)}</p>}</div><FeeControl ownerId={o.owner_id} required={o.fee_required} /></div>)}
    </section>
    <section className="mt-8"><h2 className="font-display text-2xl font-bold text-pitch">30 kỳ phí gần nhất</h2><ul className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-card">{(invoices.data as SubscriptionInvoice[]).map(i => <li key={i.id} className="flex flex-wrap justify-between gap-3 p-5 text-sm"><div><strong>{names.get(i.owner_id) ?? 'Chủ sân'} · {i.code}</strong><p className="mt-1 text-ink-secondary">{vnd(i.amount)} · {dayLabel(new Date(i.created_at))}</p></div><p>{i.status === 'paid' ? `Đã thanh toán · hạn ${dayLabel(new Date(i.period_end!))}` : 'Chờ chuyển khoản'}</p></li>)}{!invoices.data?.length && <li className="p-5 text-sm text-ink-secondary">Chưa có kỳ phí.</li>}</ul></section>
    <section className="mt-8"><h2 className="font-display text-2xl font-bold text-pitch">30 giao dịch gần nhất</h2><ul className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-card">{(receipts.data as unknown as Receipt[]).map(r => <li key={r.transaction_key} className="p-5 text-sm"><div className="flex flex-wrap justify-between gap-3"><strong>{names.get(r.subscription_invoices.owner_id) ?? 'Chủ sân'} · {r.subscription_invoices.code}</strong><span>{vnd(r.amount)} · {OUTCOMES[r.outcome] ?? r.outcome}</span></div><p className="mt-2 break-all text-xs text-ink-secondary">{r.transaction_key} · {dayLabel(new Date(r.created_at))} · {hhmm(r.created_at)}</p></li>)}{!receipts.data?.length && <li className="p-5 text-sm text-ink-secondary">Chưa có giao dịch phí.</li>}</ul></section>
  </main>;
}
