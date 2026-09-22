import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Vận hành</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-pitch">Lịch sân</h1><p className="mt-2 text-sm text-ink-secondary">Chọn sân để xem khung trống, đơn đã đặt và khóa lịch bảo trì.</p></div><Link href="/chu-san" className="rounded-control border border-hairline bg-card px-4 py-2.5 text-sm font-semibold text-pitch hover:border-strong">← Về tổng quan</Link></header>
    <nav aria-label="Chọn sân" className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{courts.map((item) => { const itemVenue = item.venues as unknown as { name: string }; return <Link key={item.id} href={`/chu-san/lich?court=${item.id}`} className={`rounded-card border p-4 transition-colors ${item.id === id ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card hover:border-strong'}`}><span className="block text-xs opacity-70">{itemVenue.name}</span><span className="mt-1 block font-semibold">{item.name}</span><span className="mt-1 block text-xs opacity-75">Khung {item.slot_minutes} phút · {item.sport}</span></Link>; })}</nav>
    <div className="mt-2"><CourtCalendar courtId={court.id} /></div>
  </main>;
}

function Empty() { return <main className="mx-auto max-w-3xl px-5 py-16 lg:px-16"><h1 className="font-display text-3xl font-extrabold text-pitch">Chưa có sân con</h1><p className="mt-3 text-sm text-ink-secondary">Thêm sân con trong phần quản lý để xem lịch.</p><Link href="/chu-san/quan-ly" className="mt-6 inline-flex rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Quản lý sân</Link></main>; }
