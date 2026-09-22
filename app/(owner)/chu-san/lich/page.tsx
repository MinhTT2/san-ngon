import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CourtCalendar } from './court-calendar';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ court?: string }> }) {
  const id = (await searchParams).court;
  if (!id || !z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=/chu-san/lich?court=${id}`);
  const { data: court, error } = await supabase.from('courts')
    .select('id, name, sport, slot_minutes, venues!inner(id, name, owner_id)')
    .eq('id', id).eq('venues.owner_id', user.id).maybeSingle();
  if (error) throw new Error('Không tải được sân. Vui lòng thử lại.');
  if (!court) notFound();
  const venue = court.venues as unknown as { id: string; name: string };
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
    <Link href={`/chu-san/quan-ly?venue=${venue.id}`} className="text-sm font-semibold text-pitch underline">← Quản lý sân</Link>
    <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-pitch">Lịch · {court.name}</h1>
    <p className="mt-2 text-sm text-ink-secondary">{venue.name} · Mỗi ô là một khung {court.slot_minutes} phút.</p>
    <CourtCalendar courtId={court.id} />
  </main>;
}
