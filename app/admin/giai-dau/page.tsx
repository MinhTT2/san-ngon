export const dynamic = 'force-dynamic';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tournamentStatuses } from '@/lib/tournaments';
import { TournamentList } from '@/components/tournament-list';
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/giai-dau');
  const { data: admin } = await db.rpc('is_admin'); if (!admin) redirect('/');
  const params = await searchParams; const page = /^\d+$/.test(params.page ?? '') ? Math.max(1,Math.min(10000,Number(params.page))) : 1;
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><DashboardPageHeader eyebrow="Quản trị / Giải đấu" title="Duyệt giải đấu" description="Kiểm tra thể lệ, bố trí sân và thỏa thuận tiền thuê trước khi công khai đề xuất." /><form className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4"><label className="flex flex-col gap-2 text-xs font-semibold">Trạng thái<select name="status" defaultValue={params.status ?? ''} className="min-h-11 rounded-control border border-hairline bg-page px-3 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(tournamentStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="pf-action min-h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Lọc giải</button></form><TournamentList status={params.status} mode="admin" page={page} /></main>;
}
