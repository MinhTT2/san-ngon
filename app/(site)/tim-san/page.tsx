import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { DISTRICTS } from '@/lib/constants';
import { dayLabel } from '@/lib/format';
import { VenueSearchParams } from '@/lib/search-params';
import { VenueSearchForm } from '@/components/venue-search-form';
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
  searchParams: Promise<{ sport?: string; q?: string; ngay?: string; district?: string; indoor?: string; available?: string; sort?: string; page?: string; gio?: string; phut?: string }>;
}) {
  const { sport, q, ngay, district: requestedDistrict, indoor, available, sort, page, gio, phut } = VenueSearchParams.parse(await searchParams);
  const district = requestedDistrict && DISTRICTS.includes(requestedDistrict) ? requestedDistrict : undefined;
  const supabase = await createClient();

  const validSport = sport;
  const term = q?.trim() ?? '';
  const day = ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? ngay : undefined;
  const { data: result, error } = await supabase.rpc(gio || phut ? 'search_venues_for_time' : 'search_venues', {
    p_query: term, p_sport: validSport ?? null, p_district: district && DISTRICTS.includes(district) ? district : '',
    p_date: day ?? null, p_indoor: indoor === '1' ? true : indoor === '0' ? false : null,
    p_available: available === '1', p_sort: sort === 'price' || sort === 'availability' ? sort : 'name',
    p_page: page,
    ...(gio || phut ? { p_time: gio ?? null, p_duration: phut ? Number(phut) : null } : {}),
  });
  if (error) throw new Error('Không tải được danh sách sân.');
  const discovery = result as unknown as { date: string; today: string; last_date: string; total: number; page_size?: number; page: number; pages: number; venues: VenueCardData[] };
  const venues = discovery.venues ?? [];
  const { data: { user } } = await supabase.auth.getUser();
  const favorites = user && venues.length ? await supabase.from('venue_favorites').select('venue_id').eq('user_id', user.id).in('venue_id', venues.map(venue => venue.id)) : null;
  const savedIds = new Set((favorites?.data ?? []).map(favorite => favorite.venue_id));
  const dateLabel = `${discovery.date.slice(8, 10)}/${discovery.date.slice(5, 7)}/${discovery.date.slice(0, 4)}`;
  const firstResult = (discovery.page - 1) * (discovery.page_size ?? 9) + 1;
  const lastResult = firstResult + venues.length - 1;
  const resetHref = `/tim-san?ngay=${discovery.date}`;
  const applied = { sport, q: term, ngay: discovery.date, district, indoor, available, sort, gio, phut };
  const filters = [
    { key: 'sport', label: validSport && SPORT_LABELS[validSport] },
    { key: 'district', label: district }, { key: 'q', label: term && `“${term}”` },
    { key: 'indoor', label: indoor === '1' ? 'Trong nhà' : indoor === '0' ? 'Ngoài trời' : undefined },
    { key: 'available', label: available === '1' ? 'Còn giờ trống' : undefined },
    { key: 'gio', label: gio && 'Bắt đầu ' + gio }, { key: 'phut', label: phut && 'Chơi ' + phut + ' phút' },
  ].filter(filter => filter.label);
  const filtered = filters.length > 0;
  const advancedCount = Number(!!district) + Number(!!indoor) + Number(available === '1') + Number(sort !== 'name');
  const removeFilter = (key: string) => `/tim-san?${new URLSearchParams(Object.entries(applied).filter(([field, value]) => field !== key && !!value) as [string, string][])}`;

  const canKeepSport = !!validSport && filters.some(filter => filter.key !== 'sport');
  const broadenHref = canKeepSport ? `/tim-san?${new URLSearchParams({ ngay: discovery.date, sport: validSport })}` : resetHref;
  const recoveryOptions = [
    available === '1' && { href: removeFilter('available'), label: 'Xem cả sân hết giờ trống' },
    term && { href: removeFilter('q'), label: 'Bỏ tìm theo tên' },
    district && { href: removeFilter('district'), label: 'Xem các khu vực khác' },
    indoor && { href: removeFilter('indoor'), label: 'Xem cả sân trong và ngoài trời' },
  ].filter((option): option is { href: string; label: string } => !!option).slice(0, 2);

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
      <VenueSearchForm queryKey={JSON.stringify(applied)}>
        <h2 className="col-span-2 flex items-center gap-2 border-b border-hairline pb-3 font-display text-lg font-bold text-pitch lg:col-span-1"><SlidersHorizontal size={17} aria-hidden="true" />Lọc sân</h2>
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="q" className="text-xs font-semibold text-ink-secondary">Bạn muốn chơi ở đâu?</label><div className="relative"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-ink-secondary" /><input id="q" name="q" type="search" defaultValue={q} maxLength={100} placeholder="Tên sân, đường hoặc quận" className="h-11 w-full min-w-0 rounded-control border border-hairline bg-page pl-10 pr-3 text-sm" /></div></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="sport" className="text-xs font-semibold text-ink-secondary">Môn thể thao</label><select id="sport" name="sport" defaultValue={sport ?? ''} className="h-11 min-w-0 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="ngay" className="text-xs font-semibold text-ink-secondary">Ngày chơi</label><input id="ngay" name="ngay" type="date" min={discovery.today} max={discovery.last_date} defaultValue={discovery.date} className="h-11 w-full min-w-0 rounded-control border border-hairline bg-page px-2 text-sm" /><span className="text-xs text-ink-secondary">{dayLabel(new Date(discovery.date + 'T12:00:00+07:00'))} · Giờ Việt Nam</span></div>

        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="gio" className="text-xs font-semibold text-ink-secondary">Giờ bắt đầu (tùy chọn)</label><input id="gio" type="time" name="gio" defaultValue={gio} className="h-11 w-full rounded-control border border-hairline bg-page px-2 text-sm" /></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-1"><label htmlFor="phut" className="text-xs font-semibold text-ink-secondary">Thời lượng chơi</label><select id="phut" name="phut" defaultValue={phut ?? ''} className="h-11 w-full rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Bất kỳ thời lượng</option>{['30','60','90','120','180'].map(value => <option key={value} value={value}>{value} phút</option>)}</select></div>
        {(gio || phut) && <p className="col-span-2 text-xs leading-6 text-ink-secondary lg:col-span-1">Chỉ hiện sân trống liền mạch cho giờ bắt đầu và thời lượng đã chọn.</p>}
        <ResponsiveDisclosure sidebar mobileOpen={advancedCount > 0} count={advancedCount}>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="district" className="text-xs font-semibold text-ink-secondary">Khu vực</label><select id="district" name="district" defaultValue={district ?? ''} className="h-11 min-w-0 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả quận/huyện</option>{DISTRICTS.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="indoor" className="text-xs font-semibold text-ink-secondary">Loại sân</label><select id="indoor" name="indoor" defaultValue={indoor ?? ''} className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả</option><option value="1">Trong nhà</option><option value="0">Ngoài trời</option></select></div>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="sort" className="text-xs font-semibold text-ink-secondary">Sắp xếp</label><select id="sort" name="sort" defaultValue={sort ?? 'name'} className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="name">Tên A–Z</option><option value="availability">Nhiều giờ trống</option><option value="price">Giá thấp trước</option></select></div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2 lg:col-span-1"><input type="checkbox" name="available" value="1" defaultChecked={available === '1'} className="size-4 accent-pitch" />Chỉ hiện sân còn giờ trống</label>
        </ResponsiveDisclosure>
      </VenueSearchForm>
      </aside>
      <section aria-label="Kết quả tìm sân" className="min-w-0">
        <SportShortcuts pathname="/tim-san" sport={sport} params={applied} />
      {filtered && <div aria-label="Bộ lọc đang áp dụng" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
        <span>Đang lọc:</span>{filters.map(f => <Link key={f.key} scroll={false} href={removeFilter(f.key)} aria-label={`Bỏ lọc ${f.label}`} className="pf-action inline-flex min-h-11 max-w-full items-center gap-2 rounded-pill border border-hairline bg-card px-3 font-medium text-ink hover:border-pitch"><span className="truncate">{f.label}</span><X size={14} className="shrink-0" aria-hidden="true" /></Link>)}
        <Link href={resetHref} className="inline-flex min-h-11 items-center px-2 font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</Link>
      </div>}
      <div id="ket-qua" tabIndex={-1} className="scroll-mt-24 focus:outline-2 focus:outline-offset-4 focus:outline-pitch mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
        <div><h2 className="font-display text-xl font-bold text-pitch">Danh sách sân</h2><p className="mt-2 text-xs leading-6 text-ink-secondary">{discovery.total ? `Hiển thị ${firstResult}–${lastResult} / ${discovery.total} cụm sân · Lịch ngày ${dateLabel}` : `Không có kết quả phù hợp ngày ${dateLabel}`}</p></div>
        <p className="flex items-center gap-1.5 text-xs text-ink-secondary"><span className="size-1.5 rounded-full bg-pitch" aria-hidden="true" />Khung trống tính trên từng sân con</p>
      </div>
      <ul data-sparse={venues.length > 0 && venues.length <= 2} className="pf-venue-results mt-5 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {venues.map(v => <VenueCard key={v.id} venue={v} sport={validSport} date={discovery.date} startTime={gio} duration={phut} signedIn={!!user} saved={favorites?.error ? null : savedIds.has(v.id)} returnPath={`/tim-san?${new URLSearchParams(Object.entries({ ...applied, ...(discovery.page > 1 ? { page: String(discovery.page) } : {}) }).filter(([, value]) => !!value) as [string, string][])}`} />)}
      </ul>
      {discovery.pages > 1 && <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-2"><PaginationLink page={discovery.page - 1} disabled={discovery.page <= 1} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort, gio, phut }} label="←" />{Array.from({ length: discovery.pages }, (_, i) => i + 1).slice(Math.max(0, discovery.page - 3), discovery.page + 2).map(n => <PaginationLink key={n} page={n} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort, gio, phut }} label={String(n)} active={n === discovery.page} />)}<PaginationLink page={discovery.page + 1} disabled={discovery.page >= discovery.pages} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort, gio, phut }} label="→" /></nav>}
      {!venues.length && <DiscoveryEmpty title={filtered ? 'Thử một ngày hoặc khu vực khác' : 'Sân mới đang được cập nhật'} description={filtered ? `Không có sân phù hợp ngày ${dateLabel}. Bỏ bớt bộ lọc để tìm thêm lựa chọn cho buổi chơi.` : 'Chưa có sân để hiển thị. Bạn có thể quay lại sau hoặc liên hệ Sân Ngon để được hỗ trợ.'} href={filtered ? broadenHref : '/lien-he'} label={filtered ? canKeepSport ? 'Giữ môn và ngày, tìm rộng hơn' : 'Xóa bộ lọc, giữ ngày chơi' : 'Liên hệ hỗ trợ'} alternatives={filtered ? recoveryOptions : []} />}
      </section>
      </div>
    </main>
  );
}

function PaginationLink({ page, params, label, disabled, active }: { page: number; params: Record<string | number, string | undefined>; label: string; disabled?: boolean; active?: boolean }) {
  const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, value]) => value));
  return disabled ? <span aria-hidden="true" className="grid size-11 place-items-center rounded-control border border-hairline text-ink-secondary/40">{label}</span> : <Link aria-label={label === '←' ? 'Trang trước' : label === '→' ? 'Trang sau' : `Trang ${page}`} aria-current={active ? 'page' : undefined} href={`/tim-san?${query}#ket-qua`} className={`pf-action grid size-11 place-items-center rounded-control border text-sm font-semibold ${active ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card'}`}>{label}</Link>;
}
