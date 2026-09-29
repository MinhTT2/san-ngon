export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tournamentStatuses } from '@/lib/tournaments';
import { TournamentList } from '@/components/tournament-list';
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/giai-dau');
  const { data: admin } = await db.rpc('is_admin'); if (!admin) redirect('/');
  const params = await searchParams; const page = /^\d+$/.test(params.page ?? '') ? Math.max(1,Math.min(10000,Number(params.page))) : 1;
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-12"><h1 className="font-display text-3xl font-extrabold text-pitch">Duyệt giải đấu</h1><p className="mt-3 text-sm text-ink-secondary">Mở đề xuất để kiểm tra thể lệ, bố trí sân và trao quyền quản lý cho người đề xuất.</p><form className="mt-6 flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-card p-4"><label className="flex flex-col gap-2 text-xs font-semibold">Trạng thái<select name="status" defaultValue={params.status ?? ''} className="min-h-11 rounded-control border border-hairline bg-page px-3 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(tournamentStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="min-h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Lọc giải</button></form><TournamentList status={params.status} mode="admin" page={page} /></main>;
}
