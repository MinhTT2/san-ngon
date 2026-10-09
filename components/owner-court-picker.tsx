'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SPORT_LABELS } from '@/lib/constants';

type Option = { id: string; name: string; sport: string; slot_minutes: number; venueId: string; venueName: string };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
export function OwnerCourtPicker({ courts, selectedId }: { courts: Option[]; selectedId: string }) {
  const [query, setQuery] = useState('');
  const [venue, setVenue] = useState('');
  const [sport, setSport] = useState('');
  const [page, setPage] = useState(1);
  const venues = [...new Map(courts.map(court => [court.venueId, court.venueName])).entries()];
  const sports = [...new Set(courts.map(court => court.sport))];
  const filtered = courts.filter(court => (!venue || court.venueId === venue) && (!sport || court.sport === sport) && normalize(court.name + ' ' + court.venueName).includes(normalize(query.trim()))).sort((a,b) => a.venueName.localeCompare(b.venueName,'vi') || a.sport.localeCompare(b.sport) || a.name.localeCompare(b.name,'vi'));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages);
  const selected = courts.find(court => court.id === selectedId);
  return <section className="mt-6 rounded-card border border-hairline bg-card p-4">
    <h2 className="font-semibold text-pitch">Chọn sân vận hành</h2>
    <p className="mt-2 text-sm text-ink-secondary">Đang xem: {selected?.venueName} · {selected?.name}</p>
    {courts.length > 4 && <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Tìm sân nhanh<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Tên sân hoặc cụm sân" className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm" /></label><label className="text-xs font-semibold">Cụm sân<select value={venue} onChange={event => { setVenue(event.target.value); setPage(1); }} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm"><option value="">Tất cả cụm sân</option>{venues.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="text-xs font-semibold">Môn thể thao<select value={sport} onChange={event => { setSport(event.target.value); setPage(1); }} className="mt-1 h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm"><option value="">Tất cả môn</option>{sports.map(value => <option key={value} value={value}>{SPORT_LABELS[value] ?? value}</option>)}</select></label></div>}
    <nav aria-label="Chọn sân" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{filtered.slice((current-1)*12,current*12).map(court => <Link key={court.id} href={'/chu-san/lich?court=' + court.id} aria-current={court.id === selectedId ? 'page' : undefined} className={'rounded-control border p-3 ' + (court.id === selectedId ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-page text-pitch')}><span className="block text-xs">{court.venueName} · {SPORT_LABELS[court.sport] ?? court.sport}</span><strong className="mt-1 block break-words text-sm">{court.name}</strong><span className="mt-1 block text-xs">Khung {court.slot_minutes} phút</span></Link>)}</nav>
    {!filtered.length && <p role="status" className="mt-4 text-sm text-ink-secondary">Không có sân khớp. Thử bỏ từ khóa hoặc bộ lọc.</p>}
    {pages > 1 && <div className="mt-4 flex items-center gap-3 text-sm"><button type="button" disabled={current===1} onClick={() => setPage(current-1)} className="min-h-11 rounded-control border border-hairline px-3 disabled:opacity-50">Trang trước</button><span>{current}/{pages}</span><button type="button" disabled={current===pages} onClick={() => setPage(current+1)} className="min-h-11 rounded-control border border-hairline px-3 disabled:opacity-50">Trang sau</button></div>}
  </section>;
}
