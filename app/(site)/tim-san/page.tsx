import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { DISTRICTS } from '@/lib/constants';
import { hhmm, vnd } from '@/lib/format';
import { VenueSearchParams } from '@/lib/search-params';
import { ResponsiveDisclosure } from '@/components/responsive-disclosure';
import { FavoriteButton } from '@/components/favorite-button';
import { X } from 'lucide-react';

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
  const discovery = result as unknown as { date: string; today: string; last_date: string; total: number; page: number; pages: number; venues: Array<{ id: string; slug: string; name: string; address: string; district: string; images: string[]; amenities: string[]; court_count: number; sports: string[]; available_slots: number; min_price: number | null; next_slot: string | null }> };
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
    <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 lg:px-16 lg:pt-12">
      <header className="flex flex-col gap-3 border-b border-hairline pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Tìm sân ở Hà Nội</p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight text-pitch sm:text-4xl">Tìm sân, chọn giờ chơi.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">Chọn môn, ngày chơi và khu vực để xem sân phù hợp.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-ink-secondary"><span className="grid size-10 place-items-center rounded-full bg-pitch font-display text-lg font-bold text-pitch-ink">{discovery.total}</span><span>cụm sân<br />phù hợp</span></div>
      </header>

      <form key={JSON.stringify(applied)} action="/tim-san" aria-label="Tìm và lọc sân" className="relative z-10 mt-5 grid grid-cols-2 gap-3 rounded-card border border-hairline bg-card p-4 sm:p-5 lg:grid-cols-12 lg:items-end">
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 lg:col-span-5"><label htmlFor="q" className="text-xs font-semibold text-ink-secondary">Bạn muốn chơi ở đâu?</label><input id="q" name="q" defaultValue={q} maxLength={100} placeholder="Tên sân, đường hoặc quận" className="h-12 min-w-0 rounded-control border border-hairline bg-page px-3 text-sm" /></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-3"><label htmlFor="sport" className="text-xs font-semibold text-ink-secondary">Môn thể thao</label><select id="sport" name="sport" defaultValue={sport ?? ''} className="h-12 min-w-0 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2"><label htmlFor="ngay" className="text-xs font-semibold text-ink-secondary">Ngày chơi</label><input id="ngay" name="ngay" type="date" min={discovery.today} max={discovery.last_date} defaultValue={discovery.date} className="h-12 w-full min-w-0 rounded-control border border-hairline bg-page px-2 text-sm" /></div>
        <button className="pf-action col-span-2 h-12 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink transition-colors hover:bg-pitch/90 lg:col-span-2">Tìm sân <span aria-hidden="true" className="pf-arrow ml-2">→</span></button>
        <ResponsiveDisclosure mobileOpen={advancedCount > 0} count={advancedCount}>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="district" className="text-xs font-semibold text-ink-secondary">Khu vực</label><select id="district" name="district" defaultValue={district ?? ''} className="h-11 min-w-0 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả quận/huyện</option>{DISTRICTS.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="indoor" className="text-xs font-semibold text-ink-secondary">Loại sân</label><select id="indoor" name="indoor" defaultValue={indoor ?? ''} className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả</option><option value="1">Trong nhà</option><option value="0">Ngoài trời</option></select></div>
          <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor="sort" className="text-xs font-semibold text-ink-secondary">Sắp xếp</label><select id="sort" name="sort" defaultValue={sort ?? 'name'} className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="name">Tên A–Z</option><option value="availability">Nhiều giờ trống</option><option value="price">Giá thấp trước</option></select></div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2 lg:col-span-1"><input type="checkbox" name="available" value="1" defaultChecked={available === '1'} className="size-4 accent-pitch" /> Chỉ hiện sân còn giờ trống</label>
        </ResponsiveDisclosure>
      </form>

      {filtered && (
        <div aria-label="Bộ lọc đang áp dụng" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
          <span>Đang lọc:</span>
          {filters.map((f) => (
            <Link key={f.key} scroll={false} href={removeFilter(f.key)} aria-label={`Bỏ lọc ${f.label}`} title={`Bỏ lọc ${f.label}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-pill border border-hairline bg-sunk px-3 text-sm text-ink hover:border-pitch"><span className="truncate">{f.label}</span><X size={15} className="shrink-0" aria-hidden="true" /></Link>
          ))}
          <Link href={resetHref} className="text-sm font-semibold text-pitch underline underline-offset-2">
            Xóa bộ lọc
          </Link>
        </div>
      )}

      <div id="ket-qua" className="mt-6 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Lịch trống ngày {dateLabel}</p><p className="mt-2 text-sm text-ink-secondary">{discovery.total ? `Hiển thị ${venues.length} trong ${discovery.total} cụm sân · Số khung trống tính trên từng sân con` : 'Không có kết quả phù hợp'}</p></div>{sort && <span className="hidden text-sm text-ink-secondary sm:inline">{sort === 'price' ? 'Giá thấp trước' : sort === 'availability' ? 'Nhiều giờ trống trước' : 'Tên A–Z'}</span>}</div>

      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((v) => {
          const sports = v.sports.map((s) => SPORT_LABELS[s] ?? s);
          const image = v.images?.[0] ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${v.images[0]}` : undefined;
          return (
            <li key={v.id} className="pf-card group relative flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-pitch">
              <Link href={`/san/${v.slug}?ngay=${discovery.date}`} aria-label={`Xem lịch ${v.name}`}>
                <div className="relative overflow-hidden"><div className="h-48 w-full bg-sunk bg-cover bg-center transition-transform duration-500 motion-safe:group-hover:scale-[1.025] motion-reduce:transition-none" style={image ? { backgroundImage: `url(${image})` } : undefined} />{!image && <div className="absolute inset-0 grid place-items-center bg-sunk text-xs text-ink-secondary">Chủ sân chưa thêm ảnh</div>}<div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" /><span className="absolute bottom-3 left-4 rounded-pill bg-white/90 px-2.5 py-1 text-xs font-semibold text-pitch">{v.available_slots > 0 ? `Còn giờ ngày ${dateLabel}` : `Hết giờ ngày ${dateLabel}`}</span></div>
              </Link>
              <div className="absolute right-3 top-3 z-10"><FavoriteButton compact venueName={v.name} venueId={v.id} signedIn={!!user} saved={favorites?.error ? null : savedIds.has(v.id)} returnPath={`/tim-san?${new URLSearchParams(Object.entries(applied).filter(([, value]) => !!value) as [string, string][])}`} /></div>
              <div className="flex flex-1 flex-col p-5">
                <Link href={`/san/${v.slug}?ngay=${discovery.date}`} className="font-display text-xl font-bold tracking-tight text-pitch hover:underline">
                  {v.name}
                </Link>
                <span className="mt-1 text-sm text-ink-secondary">{v.district} · {v.address}</span>
                <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-pill bg-sunk px-2.5 py-1 text-xs text-ink-secondary">{sports.join(' · ')}</span><span className="rounded-pill bg-sunk px-2.5 py-1 text-xs text-ink-secondary">{v.court_count} sân</span></div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-hairline pt-4"><div><p className="text-xs text-ink-secondary">Khung còn trống</p><p className="mt-1 font-semibold text-pitch">{v.available_slots}{v.next_slot && <span className="mt-1 block text-xs font-normal text-ink-secondary">Sớm nhất {hhmm(v.next_slot)}</span>}</p></div><div><p className="text-xs text-ink-secondary">Giá từ</p><p className="mt-1 font-semibold text-pitch">{v.min_price != null ? `${vnd(v.min_price)}/giờ` : '—'}</p></div></div>
                <Link href={`/san/${v.slug}?ngay=${discovery.date}`} className="pf-action mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-control border border-pitch px-3 text-sm font-semibold text-pitch transition-colors hover:bg-pitch hover:text-pitch-ink">Xem lịch sân <span aria-hidden="true" className="pf-arrow ml-2">→</span></Link>
              </div>
            </li>
          );
        })}
      </ul>

      {discovery.pages > 1 && <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-2"><PaginationLink page={discovery.page - 1} disabled={discovery.page <= 1} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort }} label="←" />{Array.from({ length: discovery.pages }, (_, i) => i + 1).slice(Math.max(0, discovery.page - 3), discovery.page + 2).map((n) => <PaginationLink key={n} page={n} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort }} label={String(n)} active={n === discovery.page} />)}<PaginationLink page={discovery.page + 1} disabled={discovery.page >= discovery.pages} params={{ sport, q, ngay: discovery.date, district, indoor, available, sort }} label="→" /></nav>}

      {venues.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-card border border-hairline p-10 text-center">
          {filtered ? (
            <>
              <p className="text-sm text-ink-secondary">
                Không tìm thấy sân phù hợp ngày {dateLabel}. Thử đổi ngày hoặc bớt bộ lọc.
              </p>
              <Link href={resetHref} className="text-sm font-semibold text-pitch underline underline-offset-2">
                Xóa bộ lọc, giữ ngày chơi
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink-secondary">
              Chưa có sân để hiển thị. Bạn có thể quay lại sau hoặc liên hệ Sân Ngon để được hỗ trợ.
            </p>
          )}
          <Link href="/lien-he" className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline underline-offset-4">Liên hệ hỗ trợ</Link>
        </div>
      )}
    </main>
  );
}

function PaginationLink({ page, params, label, disabled, active }: { page: number; params: Record<string | number, string | undefined>; label: string; disabled?: boolean; active?: boolean }) {
  const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, value]) => value));
  return disabled ? <span aria-hidden="true" className="grid size-11 place-items-center rounded-control border border-hairline text-ink-secondary/40">{label}</span> : <Link aria-label={label === '←' ? 'Trang trước' : label === '→' ? 'Trang sau' : `Trang ${page}`} aria-current={active ? 'page' : undefined} href={`/tim-san?${query}`} className={`grid size-11 place-items-center rounded-control border text-sm font-semibold ${active ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card'}`}>{label}</Link>;
}
