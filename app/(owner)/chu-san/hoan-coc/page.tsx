import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DashboardPageHeader, DashboardLink } from '@/components/dashboard-page-header';
import { OwnerVenuePicker } from '@/components/owner-venue-picker';
import { RefundDoneButton } from '@/components/owner-booking-actions';
import { QueryError } from '@/components/query-error';
import { dayLabel, hhmm, vnd, ymd } from '@/lib/format';

type Refund = { id: string; code: string; starts_at: string; ends_at: string; deposit_amount: number; customer_name: string | null; customer_phone: string; court_name: string; refund_status: 'needed' | 'done' };
type Result = { total: number; page: number; pages: number; needed: number; done: number; rows: Refund[] };
const filtersSchema = z.object({ venue: z.string().optional(), status: z.enum(['all','needed','done']).catch('needed'), q: z.string().trim().max(100).catch(''), page: z.coerce.number().int().min(1).max(100000).catch(1) });
export const dynamic='force-dynamic';
export const metadata={ title:'Hoàn cọc · Sân Ngon' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params=filtersSchema.parse(await searchParams);
  const db=await createClient();
  const { data:{ user } }=await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/hoan-coc');
  const { data:venues,error:venuesError }=await db.from('venues').select('id,name').eq('owner_id',user.id).order('created_at').order('id');
  if (venuesError) throw new Error('Không tải được cụm sân.');
  const venue=venues?.find(item=>item.id===params.venue) ?? venues?.[0];
  if (!venue) return <main className="mx-auto max-w-3xl px-5 py-10"><h1 className="font-display text-3xl font-bold text-pitch">Chưa có cụm sân để đối soát</h1><Link href="/chu-san/quan-ly" className="mt-4 inline-flex min-h-11 items-center text-pitch underline">Quản lý sân</Link></main>;
  const { data,error }=await db.rpc('get_owner_refund_page',{ p_venue_id:venue.id,p_status:params.status,p_query:params.q,p_page:params.page });
  const result=!error && data ? data as unknown as Result : null;
  const href=(page:number,status=params.status)=>'/chu-san/hoan-coc?'+new URLSearchParams({ venue:venue.id,status,q:params.q,page:String(page) });
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><DashboardPageHeader eyebrow="Chủ sân / Đối soát" title="Hoàn cọc và lịch sử" description="Tra cả đơn đã qua ngày chơi. Hoàn tiền thực hiện thủ công, đánh dấu sau khi chuyển đủ." actions={<DashboardLink href={'/chu-san/don?venue='+venue.id}>Đơn đặt sân</DashboardLink>} />
    <OwnerVenuePicker venues={venues!} selectedId={venue.id} pathname="/chu-san/hoan-coc" query={{status:params.status,q:params.q}} />
    <form className="mt-5 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4"><input type="hidden" name="venue" value={venue.id} /><input type="hidden" name="status" value={params.status} /><label className="min-w-0 flex-1 text-sm font-semibold">Mã đơn, khách hoặc số điện thoại<input name="q" maxLength={100} defaultValue={params.q} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 font-normal" /></label><button className="min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Tìm khoản hoàn</button>{params.q && <Link href={href(1).replace('&q='+encodeURIComponent(params.q),'')} className="inline-flex min-h-11 items-center text-sm text-pitch underline">Xóa tìm kiếm</Link>}</form>
    {result ? <><nav aria-label="Lọc hoàn cọc" className="mt-5 flex gap-2 overflow-x-auto">{(['needed','done','all'] as const).map(status=><Link key={status} href={href(1,status)} aria-current={status===params.status?'page':undefined} className={'inline-flex min-h-11 shrink-0 items-center rounded-control border px-4 text-sm font-semibold '+(status===params.status?'border-pitch bg-pitch text-pitch-ink':'border-hairline bg-card text-pitch')}>{status==='needed'?'Cần hoàn ('+result.needed+')':status==='done'?'Đã hoàn ('+result.done+')':'Tất cả'}</Link>)}</nav><p className="mt-4 text-sm text-ink-secondary">{result.total} đơn · Toàn bộ lịch sử · Số tiền là cọc theo đơn; khoản chuyển thiếu/thừa cần đối soát riêng.</p><ul className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-card">{result.rows.map(row=><li key={row.id} className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="break-words font-semibold text-pitch">{row.code} · {row.customer_name ?? 'Khách'} · {row.court_name}</p><p className="mt-2 text-sm text-ink-secondary">{dayLabel(new Date(row.starts_at))}/{ymd(new Date(row.starts_at)).slice(0,4)} · {hhmm(row.starts_at)}–{hhmm(row.ends_at)}</p><a href={'tel:'+row.customer_phone} className="inline-flex min-h-11 items-center text-sm text-pitch underline">{row.customer_phone}</a><p className="text-sm font-semibold">Cọc {vnd(row.deposit_amount)}</p></div>{row.refund_status==='needed'?<RefundDoneButton code={row.code} customerName={row.customer_name} customerPhone={row.customer_phone} courtName={row.court_name} depositAmount={row.deposit_amount} />:<span className="rounded-pill bg-free-fill px-3 py-2 text-sm font-semibold text-success">Đã đánh dấu hoàn cọc</span>}</li>)}</ul>{!result.rows.length && <p className="mt-5 rounded-card border border-hairline bg-card p-8 text-center text-sm text-ink-secondary">Không có khoản hoàn phù hợp. Thử đổi trạng thái hoặc từ khóa.</p>}{result.pages>1 && <nav aria-label="Phân trang hoàn cọc" className="mt-5 flex items-center justify-center gap-4 text-sm">{result.page>1 && <Link href={href(result.page-1)} className="min-h-11 py-3 text-pitch">← Trang trước</Link>}<span>{result.page}/{result.pages}</span>{result.page<result.pages && <Link href={href(result.page+1)} className="min-h-11 py-3 text-pitch">Trang sau →</Link>}</nav>}</>:<QueryError className="mt-5" title="Chưa tải được lịch sử hoàn cọc" />}
  </main>;
}
