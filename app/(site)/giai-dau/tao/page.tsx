export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { TournamentFields } from '@/components/tournament-fields';
export const metadata = { title: 'Đề xuất tổ chức giải đấu' };
export default async function Page() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/giai-dau/tao');
  const { data: venues, error } = await db.from('venues').select('id,name,courts(id,name,sport,is_active)').eq('owner_id', user.id).eq('status', 'active');
  if (error) throw new Error('Chưa tải được danh sách sân.');
  const courts = (venues ?? []).flatMap(v => v.courts.filter(c => c.is_active).map(c => ({ id: c.id, name: c.name, venue: v.name, sport: c.sport })));
  return <main className="mx-auto max-w-4xl px-5 py-10 lg:py-14"><Link href="/giai-dau?view=mine" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-pitch">← Giải tôi tổ chức</Link><h1 className="font-display text-3xl font-extrabold text-pitch">Đề xuất tổ chức giải</h1>
    <p className="mb-8 mt-3 text-sm leading-7 text-ink-secondary">Chủ sân chọn sân của mình; người chơi có thể nhờ admin bố trí địa điểm. Sau khi admin duyệt, bạn được quản lý giải và danh sách đăng ký ngay tại đây.</p>
    <section className="rounded-card border border-hairline bg-card p-5 sm:p-8"><ActionForm payload={{ action: 'submit' }} nested label="Gửi admin duyệt" successMessage="Đã gửi đề xuất. Đang mở trang theo dõi…" successHref="tournament"><TournamentFields courts={courts} /></ActionForm></section>
  </main>;
}
