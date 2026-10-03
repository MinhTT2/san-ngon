export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { TournamentFields } from '@/components/tournament-fields';
export const metadata = { title: 'Tổ chức giải đấu' };
export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/giai-dau/tao');
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
  return <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10"><Link href="/giai-dau?view=mine" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-pitch">← Giải tôi tổ chức</Link><h1 className="font-display text-3xl font-extrabold text-pitch">{owner ? (edit ? 'Chỉnh sửa và công khai giải' : 'Tạo giải đấu tại sân') : (edit ? 'Chỉnh sửa và gửi lại đề xuất' : 'Đề xuất tổ chức giải')}</h1>
    <p className="mb-8 mt-3 text-sm leading-7 text-ink-secondary">{owner ? 'Chọn sân của bạn để công khai giải ngay, không cần admin duyệt. Hệ thống khóa lịch sân trong thời gian tổ chức; bạn quản lý đăng ký, thu cọc và hoàn tiền.' : 'Mô tả giải và địa điểm mong muốn để admin bố trí sân và duyệt. Sau khi được duyệt, bạn quản lý giải và danh sách đăng ký ngay tại đây.'}</p>
    {owner && !courts.length ? <p className="rounded-card border border-hairline bg-card p-5 text-sm leading-7">Bạn cần có sân đang hoạt động để tạo giải. <Link href="/chu-san/quan-ly" className="font-semibold text-pitch underline">Quản lý sân của bạn →</Link></p> : <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="rounded-card border border-hairline bg-free-fill p-5 lg:sticky lg:top-6"><h2 className="font-display text-lg font-bold text-pitch">Chuẩn bị giải của bạn</h2><nav aria-label="Các phần tạo giải" className="mt-4 space-y-2">{[['thong-tin-giai','01','Thông tin & địa điểm'],['lich-giai','02','Lịch & số suất'],['le-phi-giai','03','Lệ phí & thể lệ']].map(([target,number,label]) => <a key={target} href={`#${target}`} className="flex min-h-11 items-center gap-3 text-sm font-semibold text-pitch"><span className="text-xs text-ink-secondary">{number}</span>{label}</a>)}</nav><p className="mt-4 border-t border-strong pt-4 text-xs leading-6 text-ink-secondary">{owner ? 'Công khai sẽ giữ lịch sân ngay. Kiểm tra ngày, giờ và lệ phí trước khi gửi.' : 'Đề xuất được gửi admin để bố trí sân. Bạn theo dõi kết quả ngay trên trang giải.'}</p></aside><section className="min-w-0 rounded-card border border-hairline bg-card p-5 sm:p-8"><ActionForm payload={edit ? { action: 'resubmit', id: edit } : { action: 'submit' }} nested label={owner ? 'Công khai giải đấu' : 'Gửi admin duyệt'} successMessage={owner ? 'Đã công khai giải và khóa lịch sân. Đang mở trang quản lý…' : 'Đã gửi đề xuất. Đang mở trang theo dõi…'} successHref="tournament"><TournamentFields initial={initial} courts={courts} owner={owner} /></ActionForm></section></div>}
  </main>;
}
