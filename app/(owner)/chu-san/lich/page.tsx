import Link from 'next/link';
import { DashboardPageHeader, DashboardLink } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { OwnerCourtPicker } from '@/components/owner-court-picker';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CourtCalendar } from './court-calendar';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ court?: string }> }) {
  const requestedId = (await searchParams).court;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=/chu-san/lich${requestedId ? `?court=${requestedId}` : ''}`);
  const { data: courts, error } = await supabase.from('courts')
    .select('id, name, sport, slot_minutes, venues!inner(id, name, owner_id)')
    .eq('venues.owner_id', user.id).order('sort_order').order('name');
  if (error) throw new Error('Không tải được danh sách sân. Vui lòng thử lại.');
  if (!courts?.length) return <Empty />;
  const id = requestedId && z.string().uuid().safeParse(requestedId).success && courts.some((item) => item.id === requestedId) ? requestedId : courts[0].id;
  if (id !== requestedId) redirect(`/chu-san/lich?court=${id}`);
  const court = courts.find((item) => item.id === id)!;
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Chủ sân / Vận hành" title="Lịch sân" description="Chọn sân để xem khung trống, đơn đã đặt và khóa lịch bảo trì." actions={<DashboardLink href="/chu-san">Tổng quan</DashboardLink>} />
    <OwnerCourtPicker selectedId={id} courts={courts.map(item => { const v = item.venues as unknown as { id: string; name: string }; return { id:item.id,name:item.name,sport:item.sport,slot_minutes:item.slot_minutes,venueId:v.id,venueName:v.name }; })} />
    <div className="mt-2"><CourtCalendar key={court.id} courtId={court.id} /></div>
  </main>;
}

function Empty() { return <main className="mx-auto max-w-3xl px-5 py-16 lg:px-16"><h1 className="font-display text-3xl font-extrabold text-pitch">Chưa có sân con</h1><p className="mt-3 text-sm text-ink-secondary">Thêm sân con trong phần quản lý để xem lịch.</p><Link href="/chu-san/quan-ly" className="mt-6 inline-flex rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Quản lý sân</Link></main>; }
