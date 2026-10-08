import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { DashboardRecords } from '@/components/dashboard-records';
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
  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Quản trị / Phí dịch vụ" title="Phí sử dụng của chủ sân" description="299.000đ/tháng cho tất cả cụm sân của một chủ sân. Tài khoản được miễn phí cho đến khi bạn bật thu phí." />
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{[{ label: 'Được miễn phí', value: rows.filter(o => !o.fee_required).length }, { label: 'Đã đóng phí còn hạn', value: rows.filter(o => o.fee_required && o.active).length }, { label: 'Cần thanh toán / gia hạn', value: rows.filter(o => o.fee_required && !o.active).length }].map(item => <div key={item.label} className="rounded-card border border-hairline bg-card p-4"><p className="font-display text-2xl font-bold tabular-nums text-pitch">{item.value}</p><p className="mt-1 text-xs text-ink-secondary">{item.label}</p></div>)}</div>
    <section className="mt-5 rounded-card border border-strong bg-free-fill p-5"><h2 className="text-sm font-semibold text-pitch">Tài khoản nhận phí website</h2><p className="mt-2 break-words text-sm text-pitch">{receiver.data ? `${receiver.data.bank} · ${receiver.data.account_number} · ${receiver.data.account_name}` : 'Chưa cấu hình tài khoản nhận phí.'}</p><p className="mt-2 text-xs leading-6 text-ink-secondary">SePay xác nhận theo mã PHI của mỗi kỳ. Hết hạn phí sẽ dừng đăng sân và nhận đơn mới; đơn cũ vẫn được xử lý.</p></section>
    <DashboardRecords title="Phí theo chủ sân" description="Tìm tài khoản và kiểm tra hạn đã thanh toán trước khi bật hoặc miễn phí."
      mobilePrimary={[1, 2, 3]} columns={['Chủ sân', 'Tình trạng phí', 'Hạn đã thanh toán', 'Thao tác']}
      statuses={[{ value: 'free', label: 'Miễn phí' }, { value: 'paid', label: 'Còn hạn' }, { value: 'due', label: 'Cần thanh toán' }]}
      records={rows.map(o => ({ id: o.owner_id, search: `${o.full_name ?? ''} ${o.phone ?? ''}`, status: !o.fee_required ? 'free' : o.active ? 'paid' : 'due', cells: [
        <div key="owner"><Link href={`/admin/owners/${o.owner_id}`} className="font-semibold text-pitch hover:underline">{o.full_name ?? 'Chưa có tên'}</Link><p className="mt-1 text-xs text-ink-secondary">{o.phone ?? 'Chưa có số điện thoại'}</p></div>,
        <span key="status" className={`inline-flex rounded-pill px-3 py-1.5 text-xs font-semibold ${!o.fee_required || o.active ? 'bg-free-fill text-pitch' : 'bg-sunk text-ink-secondary'}`}>{!o.fee_required ? 'Miễn phí' : o.active ? 'Đã đóng phí' : 'Cần thanh toán / gia hạn'}</span>,
        o.paid_until ? `${dayLabel(new Date(o.paid_until))} · ${hhmm(o.paid_until)}` : 'Chưa có', <FeeControl key="control" ownerId={o.owner_id} required={o.fee_required} />,
      ] }))} />
    <section className="mt-8"><h2 className="font-display text-xl font-bold text-pitch">30 kỳ phí gần nhất</h2><ul className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-card">{(invoices.data as SubscriptionInvoice[]).map(i => <li key={i.id} className="flex flex-wrap justify-between gap-3 p-5 text-sm"><div><strong>{names.get(i.owner_id) ?? 'Chủ sân'} · {i.code}</strong><p className="mt-1 text-ink-secondary">{vnd(i.amount)} · {dayLabel(new Date(i.created_at))}</p></div><p>{i.status === 'paid' ? `Đã thanh toán · hạn ${dayLabel(new Date(i.period_end!))}` : 'Chờ chuyển khoản'}</p></li>)}{!invoices.data?.length && <li className="p-5 text-sm text-ink-secondary">Chưa có kỳ phí.</li>}</ul></section>
    <section className="mt-8"><h2 className="font-display text-xl font-bold text-pitch">30 giao dịch gần nhất</h2><ul className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-card">{(receipts.data as unknown as Receipt[]).map(r => <li key={r.transaction_key} className="p-5 text-sm"><div className="flex flex-wrap justify-between gap-3"><strong>{names.get(r.subscription_invoices.owner_id) ?? 'Chủ sân'} · {r.subscription_invoices.code}</strong><span>{vnd(r.amount)} · {OUTCOMES[r.outcome] ?? r.outcome}</span></div><p className="mt-2 break-all text-xs text-ink-secondary">{r.transaction_key} · {dayLabel(new Date(r.created_at))} · {hhmm(r.created_at)}</p></li>)}{!receipts.data?.length && <li className="p-5 text-sm text-ink-secondary">Chưa có giao dịch phí.</li>}</ul></section>
  </main>;
}
