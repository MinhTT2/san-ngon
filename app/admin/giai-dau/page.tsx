export const dynamic = 'force-dynamic';
import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminTournamentList } from '@/components/admin-tournament-list';
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; q?: string; sport?: string }> }) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/giai-dau');
  const { data: admin, error } = await db.rpc('is_admin');
  if (error) throw new Error('Không kiểm tra được quyền quản trị. Vui lòng thử lại.');
  if (!admin) redirect('/');
  const params = await searchParams;
  return <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><DashboardPageHeader eyebrow="Quản trị / Giải đấu" title="Quản lý giải đấu" description="Ưu tiên đề xuất chờ duyệt, theo dõi sân tổ chức và mở đúng giải để xử lý." /><AdminTournamentList params={params} /></main>;
}
