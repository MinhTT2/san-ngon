export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { TournamentFields } from '@/components/tournament-fields';
import { ArrowLeft, ArrowUpRight, MapPin } from 'lucide-react';
export const metadata = { title: 'Tổ chức giải đấu' };
export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(`/giai-dau/tao${edit ? `?edit=${edit}` : ''}`)}`);
  const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (profileError) throw new Error('Chưa tải được thông tin tài khoản.');
  const owner = profile.role === 'owner';
  const { data: venues, error } = await db.from('venues').select('id,name,address,courts(id,name,sport,is_active)').eq('owner_id', user.id).eq('status', 'active');
  if (error) throw new Error('Chưa tải được danh sách sân.');
  let initial: Record<string, string | number> | undefined;
  if (edit) {
    const { data, error: editError } = await db.rpc('get_tournament_proposal', { p_id: edit });
    if (editError || !data) redirect('/giai-dau?view=mine');
    initial = data as Record<string, string | number>;
  }
  const courts = (venues ?? []).flatMap(v => v.courts.filter(c => c.is_active).map(c => ({ id: c.id, name: c.name, venue: v.name, address: v.address, sport: c.sport })));
  return <main className="mx-auto max-w-7xl px-5 py-7 lg:px-12 lg:py-10">
    <Link href="/giai-dau?view=mine" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch"><ArrowLeft size={16} aria-hidden="true" />Giải tôi tổ chức</Link>
    <header className="mb-8 border-b border-hairline pb-7">
      <h1 className="font-display text-3xl font-extrabold text-pitch">{owner ? (edit ? 'Chỉnh sửa và công khai giải' : 'Tạo giải đấu tại sân') : (edit ? 'Chỉnh sửa đề xuất giải đấu' : 'Đề xuất tổ chức giải')}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-secondary">{owner ? 'Công khai tại sân của bạn và giữ lịch cho toàn bộ thời gian thi đấu. Bạn quản lý đăng ký; cọc được chuyển vào tài khoản chủ sân.' : 'Admin bố trí sân và chốt thỏa thuận tiền thuê với hai bên trước khi công khai. Sau khi duyệt, bạn quản lý người tham gia; chủ sân nhận và hoàn tiền.'}</p>
    </header>
    {owner && !courts.length ? <section className="py-6"><MapPin size={28} className="text-pitch" aria-hidden="true" /><h2 className="mt-4 font-display text-2xl font-bold text-pitch">Chuẩn bị sân trước, mở giải sau.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-ink-secondary">Bạn cần một sân đang hoạt động để tổ chức giải. Hoàn thiện thông tin và ảnh sân, rồi quay lại chọn lịch thi đấu.</p><Link href="/chu-san/quan-ly" className="mt-5 inline-flex min-h-12 items-center gap-4 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">Quản lý sân của bạn<ArrowUpRight size={16} aria-hidden="true" /></Link></section> : <ActionForm payload={edit ? { action: 'resubmit', id: edit } : { action: 'submit' }} nested label={owner ? 'Công khai giải đấu' : 'Gửi đề xuất cho admin'} confirmMessage={owner ? 'Công khai giải và khóa lịch sân? Lịch, lệ phí và thể lệ sẽ được cố định sau khi công khai.' : undefined} className="[&_button[type=submit]]:min-h-12 [&_button[type=submit]]:w-full lg:[&_button[type=submit]]:w-[calc(100%-344px)]" successMessage={owner ? 'Đã công khai giải và khóa lịch sân. Đang mở trang quản lý…' : 'Đã gửi đề xuất. Đang mở trang theo dõi…'} successHref="tournament"><TournamentFields userId={user.id} initial={initial} courts={courts} owner={owner} /></ActionForm>}
  </main>;
}
