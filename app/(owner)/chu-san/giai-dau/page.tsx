export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TournamentList } from '@/components/tournament-list';
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/giai-dau');
  const params = await searchParams; const page = /^\d+$/.test(params.page ?? '') ? Math.max(1,Math.min(10000,Number(params.page))) : 1;
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-12"><h1 className="font-display text-3xl font-extrabold text-pitch">Giải đấu tại sân</h1><p className="my-4 text-sm text-ink-secondary">Duyệt đăng ký, theo dõi cọc SePay và xử lý hoàn tiền.</p><Link href="/giai-dau/tao" className="text-sm font-semibold text-pitch underline">Đề xuất giải mới →</Link><TournamentList mode="owner" page={page} /></main>;
}
