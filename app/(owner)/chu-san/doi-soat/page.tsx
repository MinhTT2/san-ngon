import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
export const dynamic='force-dynamic';
export const metadata={title:'Xuất đối soát đơn sân — Sân Ngon'};
export default async function Page(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/dang-nhap?next=/chu-san/doi-soat');
 const {data:venues,error}=await db.from('venues').select('id,name').eq('owner_id',user.id).order('name');
 if(error)throw new Error('Chưa tải được cụm sân.');
 return <main className="mx-auto max-w-3xl px-5 py-8"><DashboardPageHeader eyebrow="Chủ sân / Đối soát" title="Xuất danh sách đơn sân" description="Tải CSV để đối chiếu với sao kê ngân hàng. Chọn theo ngày chơi, tối đa 366 ngày và 10.000 đơn."/><form action="/api/owner/reconciliation" className="mt-7 space-y-5 rounded-card border border-hairline bg-card p-5"><label className="block text-sm font-semibold">Cụm sân<select name="venue" required className={field}>{venues?.map(venue=><option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">Từ ngày chơi<input name="from" type="date" required className={field}/></label><label className="block text-sm font-semibold">Đến hết ngày chơi<input name="to" type="date" required className={field}/></label></div><button disabled={!venues?.length} className="min-h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink disabled:opacity-60">Tải CSV đối soát</button><p className="text-xs leading-6 text-ink-secondary">File có tên, số điện thoại khách và trạng thái cọc/hoàn. Chỉ lưu và chia sẻ với người có trách nhiệm đối soát. Các số tiền là tiền trên đơn; khoản chuyển thiếu, thừa hoặc chuyển nhầm cần kiểm tra thêm trong sao kê.</p></form><Link href="/chu-san/hoan-coc" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Theo dõi hoàn cọc →</Link></main>;
}
const field='mt-2 block min-h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal';
