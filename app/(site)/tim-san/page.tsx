import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { DISTRICTS } from '@/lib/constants';
import { VenueSearchParams } from '@/lib/search-params';
import { ResponsiveDisclosure } from '@/components/responsive-disclosure';
import { VenueCard, type VenueCardData } from '@/components/venue-card';
import { SportShortcuts } from '@/components/sport-shortcuts';
import { DiscoveryEmpty } from '@/components/discovery-empty';
import { CourtFilm } from '@/components/court-film';
import { LivePageRefresh } from '@/components/live-page-refresh';
import { CalendarDays, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Danh sách sân. ?sport= và ?q= từ thanh tìm kiếm trang chủ lọc thật:
 * môn lọc ở tầng database (inner join sang courts), khu vực lọc trên tên,
 * địa chỉ và quận. Không có kết quả thì nói rõ đã lọc gì, kèm đường về.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; q?: string; ngay?: string; district?: string; indoor?: string; available?: string; sort?: string; page?: string }>;
}) {
  const { sport, q, ngay, district: requestedDistrict, indoor, available, sort, page } = VenueSearchParams.parse(await searchParams);
  const district = requestedDistrict && DISTRICTS.includes(requestedDistrict) ? requestedDistrict : undefined;
  const supabase = await createClient();

  const validSport = sport;
  const term = q?.trim() ?? '';
  const day = ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? ngay : undefined;
  const { data: result, error } = await supabase.rpc('search_venues', {
    p_query: term, p_sport: validSport ?? null, p_district: district && DISTRICTS.includes(district) ? district : '',
    p_date: day ?? null, p_indoor: indoor === '1' ? true : indoor === '0' ? false : null,
    p_available: available === '1', p_sort: sort === 'price' || sort === 'availability' ? sort : 'name',
    p_page: page,
  });
  if (error) throw new Error('Không tải được danh sách sân.');
  const discovery = result as unknown as { date: string; today: string; last_date: string; total: number; page: number; pages: number; venues: VenueCardData[] };
  const venues = discovery.venues ?? [];
  const { data: { user } } = await supabase.auth.getUser();
  const favorites = user && venues.length ? await supabase.from('venue_favorites').select('venue_id').eq('user_id', user.id).in('venue_id', venues.map(venue => venue.id)) : null;
  const savedIds = new Set((favorites?.data ?? []).map(favorite => favorite.venue_id));
  const dateLabel = `${discovery.date.slice(8, 10)}/${discovery.date.slice(5, 7)}/${discovery.date.slice(0, 4)}`;
  const resetHref = `/tim-san?ngay=${discovery.date}`;
  const applied = { sport, q: term, ngay: discovery.date, district, indoor, available, sort };
  const filters = [
    { key: 'sport', label: validSport && SPORT_LABELS[validSport] },
    { key: 'district', label: district }, { key: 'q', label: term && `“${term}”` },
    { key: 'indoor', label: indoor === '1' ? 'Trong nhà' : indoor === '0' ? 'Ngoài trời' : undefined },
    { key: 'available', label: available === '1' ? 'Còn giờ trống' : undefined },
  ].filter(filter => filter.label);
  const filtered = filters.length > 0;
  const advancedCount = Number(!!district) + Number(!!indoor) + Number(available === '1') + Number(sort !== 'name');
  const removeFilter = (key: string) => `/tim-san?${new URLSearchParams(Object.entries(applied).filter(([field, value]) => field !== key && !!value) as [string, string][])}`;

  return (
    <main className="mx-auto max-w-[1400px] px-5 pb-12 pt-6 lg:px-12 lg:pt-8">
      <LivePageRefresh scope="discovery" />
      <header className="grid items-center gap-6 border-b border-hairline pb-6 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-secondary"><MapPin size={14} aria-hidden="true" />Hà Nội / Khám phá sân</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-pitch sm:text-5xl">Tìm sân ở Hà Nội</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-ink-secondary">Chọn môn, khu vực và ngày chơi để xem sân còn giờ trống.</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-secondary">
            <span><strong className="font-display text-xl text-pitch">{discovery.total}</strong> cụm sân phù hợp</span>
            <span className="flex items-center gap-2"><CalendarDays size={15} aria-hidden="true" />Lịch ngày <strong className="font-semibold text-pitch">{dateLabel}</strong></span>
          </div>
        </div>
        <CourtFilm className="hidden lg:block" />
      </header>
      <div data-discovery-layout className="mt-6 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-6">
      <form key={JSON.stringify(applied)} action="/tim-san" aria-label="Tìm và lọc sân" className="relative grid grid-cols-2 gap-3 rounded-[20px] border border-hairline bg-card p-4 sm:p-5 lg:grid-cols-1 lg:gap-4">
        <h2 className="col-span-2 flex items-center gap-2 border-b border-hairline pb-3 font-display text-lg font-bold text-pitch lg:col-span-1"><SlidersHorizontal size={17} aria-hidden="true" />Lọc sân</h2>
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="q" className="text-xs font-semibold text-ink-secondary">Bạn muốn chơi ở đâu?</label><div className="relative"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-ink-secondary" /><input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Tên sân, đường hoặc quận" className="h-11 w-full min-w-0 rounded-control border border-hairline bg-page pl-10 pr-3 text-sm" /></div></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="sport" className="text-xs font-semibold text-ink-secondary">Môn thể thao</label><select id="sport" name="sport" defaultValue={sport ?? ''} className="h-11 min-w-0 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="ngay" className="text-xs font-semibold text-ink-secondary">Ngày chơi</label><input id="ngay" name="ngay" type="date" min={discovery.today} max={discovery.last_date} defaultValue={discovery.date} className="h-11 w-full min-w-0 rounded-control border border-hairline bg-page px-2 text-sm" /></div>

        <ResponsiveDisclosure sidebar mobileOpen={advancedCount > 0} count={advancedCount}>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="district" className="text-xs font-semibold text-ink-secondary">Khu vực</label><select id="district" name="district" defaultValue={district ?? ''} className="h-11 min-w-0 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả quận/huyện</option>{DISTRICTS.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="indoor" className="text-xs font-semibold text-ink-secondary">Loại sân</label><select id="indoor" name="indoor" defaultValue={indoor ?? ''} className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả</option><option value="1">Trong nhà</option><option value="0">Ngoài trời</option></select></div>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="sort" className="text-xs font-semibold text-ink-secondary">Sắp xếp</label><select id="sort" name="sort" defaultValue={sort ?? 'name'} className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="name">Tên A–Z</option><option value="availability">Nhiều giờ trống</option><option value="price">Giá thấp trước</option></select></div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2 lg:col-span-1"><input type="checkbox" name="available" value="1" defaultChecked={available === '1'} className="size-4 accent-pitch" />Chỉ hiện sân còn giờ trống</label>
        </ResponsiveDisclosure>
        <button className="pf-action col-span-2 h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink hover:bg-ink lg:col-span-1">Tìm sân <span aria-hidden="true" className="pf-arrow ml-2">→</span></button>
      </form>
      </aside>
      <section aria-label="Kết quả tìm sân" className="min-w-0">
        <SportShortcuts pathname="/tim-san" sport={sport} params={applied} />
      {filtered && <div aria-label="Bộ lọc đang áp dụng" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
        <span>Đang lọc:</span>{filters.map(f => <Link key={f.key} scroll={false} href={removeFilter(f.key)} aria-label={`Bỏ lọc ${f.label}`} className="pf-action inline-flex min-h-11 max-w-full items-center gap-2 rounded-pill border border-hairline bg-card px-3 font-medium text-ink hover:border-pitch"><span className="truncate">{f.label}</span><X size={14} className="shrink-0" aria-hidden="true" /></Link>)}
        <Link href={resetHref} className="inline-flex min-h-11 items-center px-2 font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>
      </div>}
      <div id="ket-qua" className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
        <div><h2 className="font-display text-xl font-bold text-pitch">Danh sách sân</h2><p className="mt-2 text-xs leading-6 text-ink-secondary">{discovery.total ? `Hiển thị ${venues.length} trong ${discovery.total} cụm sân · Lịch ngày ${dateLabel}` : `Không có kết quả phù hợp ngày ${dateLabel}`}</p></div>
        <p className="flex items-center gap-1.5 text-xs text-ink-secondary"><span className="size-1.5 rounded-full bg-pitch" aria-hidden="true" />Khung trống tính trên từng sân con</p>
      </div>
      <ul data-sparse={venues.length > 0 && venues.length <= 2} className="pf-venue-results mt-5 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {venues.map(v => <VenueCard key={v.id} venue={v} date={discovery.date} signedIn={!!user} saved={favorites?.error ? null : savedIds.has(v.id)} returnPath={`/tim-san?${new URLSearchParams(Object.entries(applied).filter(([, value]) => !!value) as [string, string][])}`} />)}
      </ul>
      {discovery.pages > 1 && <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-2"><PaginationLink page={discovery.page - 1} disabled={discovery.page <= 1} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort }} label="←" />{Array.from({ length: discovery.pages }, (_, i) => i + 1).slice(Math.max(0, discovery.page - 3), discovery.page + 2).map(n => <PaginationLink key={n} page={n} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort }} label={String(n)} active={n === discovery.page} />)}<PaginationLink page={discovery.page + 1} disabled={discovery.page >= discovery.pages} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort }} label="→" /></nav>}
      {!venues.length && <DiscoveryEmpty title={filtered ? 'Thử một ngày hoặc khu vực khác' : 'Sân mới đang được cập nhật'} description={filtered ? `Không có sân phù hợp ngày ${dateLabel}. Bỏ bớt bộ lọc để tìm thêm lựa chọn cho buổi chơi.` : 'Chưa có sân để hiển thị. Bạn có thể quay lại sau hoặc liên hệ Sân Ngon để được hỗ trợ.'} href={filtered ? resetHref : '/lien-he'} label={filtered ? 'Xóa bộ lọc, giữ ngày chơi' : 'Liên hệ hỗ trợ'} />}
      </section>
      </div>
    </main>
  );
}

function PaginationLink({ page, params, label, disabled, active }: { page: number; params: Record<string | number, string | undefined>; label: string; disabled?: boolean; active?: boolean }) {
  const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, value]) => value));
  return disabled ? <span aria-hidden="true" className="grid size-11 place-items-center rounded-control border border-hairline text-ink-secondary/40">{label}</span> : <Link aria-label={label === '←' ? 'Trang trước' : label === '→' ? 'Trang sau' : `Trang ${page}`} aria-current={active ? 'page' : undefined} href={`/tim-san?${query}`} className={`pf-action grid size-11 place-items-center rounded-control border text-sm font-semibold ${active ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card'}`}>{label}</Link>;
}
