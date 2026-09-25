import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { DISTRICTS } from '@/lib/constants';
import { hhmm, vnd } from '@/lib/format';

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
  const { sport, q, ngay, district, indoor, available, sort, page } = await searchParams;
  const supabase = await createClient();

  const validSport = sport && sport in SPORT_LABELS ? sport : undefined;
  const term = q?.trim() ?? '';
  const day = ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? ngay : undefined;
  const { data: result, error } = await supabase.rpc('search_venues', {
    p_query: term, p_sport: validSport ?? null, p_district: district && DISTRICTS.includes(district) ? district : '',
    p_date: day ?? null, p_indoor: indoor === '1' ? true : indoor === '0' ? false : null,
    p_available: available === '1', p_sort: sort === 'price' || sort === 'availability' ? sort : 'name',
    p_page: Math.max(1, Number(page) || 1),
  });
  if (error) throw new Error('Không tải được danh sách sân.');
  const discovery = result as unknown as { date: string; total: number; page: number; pages: number; venues: Array<{ id: string; slug: string; name: string; address: string; district: string; images: string[]; amenities: string[]; court_count: number; sports: string[]; available_slots: number; min_price: number | null; next_slot: string | null }> };
  const venues = discovery.venues ?? [];
  const filters = [validSport && SPORT_LABELS[validSport], district, term, indoor === '1' ? 'Trong nhà' : indoor === '0' ? 'Ngoài trời' : null, available === '1' ? 'Còn chỗ' : null].filter(Boolean) as string[];
  const filtered = filters.length > 0;

  return (
    <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 lg:px-16 lg:pt-12">
      <header className="flex flex-col gap-3 border-b border-hairline pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Tìm sân ở Hà Nội</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight text-pitch sm:text-5xl">Chọn sân cho kèo tiếp theo.</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-ink-secondary">Lọc theo môn và khu vực, xem giờ còn trống cùng mức giá trước khi mở lịch.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-ink-secondary"><span className="grid size-10 place-items-center rounded-full bg-pitch font-display text-lg font-bold text-pitch-ink">{discovery.total}</span><span>cụm sân<br />đang nhận đặt</span></div>
      </header>

      <form action="/tim-san" className="relative z-10 mt-7 grid gap-3 rounded-card border border-hairline bg-card p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-12 lg:items-end">
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-4"><label htmlFor="q" className="text-xs font-semibold text-ink-secondary">Bạn muốn chơi ở đâu?</label><input id="q" name="q" defaultValue={q} placeholder="Tên sân, đường hoặc quận" className="h-12 rounded-control border border-hairline bg-page px-3 text-sm outline-none focus:border-pitch" /></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2"><label htmlFor="sport" className="text-xs font-semibold text-ink-secondary">Môn thể thao</label><select id="sport" name="sport" defaultValue={sport ?? ''} className="h-12 rounded-control border border-hairline bg-page px-2 text-sm outline-none focus:border-pitch"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2"><label htmlFor="district" className="text-xs font-semibold text-ink-secondary">Khu vực</label><select id="district" name="district" defaultValue={district ?? ''} className="h-12 rounded-control border border-hairline bg-page px-2 text-sm outline-none focus:border-pitch"><option value="">Tất cả quận/huyện</option>{DISTRICTS.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2"><label htmlFor="ngay" className="text-xs font-semibold text-ink-secondary">Ngày chơi</label><input id="ngay" name="ngay" type="date" defaultValue={day} className="h-12 rounded-control border border-hairline bg-page px-2 text-sm outline-none focus:border-pitch" /></div>
        <button className="pf-action h-12 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink transition-colors hover:bg-pitch/90 lg:col-span-2">Xem lịch trống <span aria-hidden="true" className="pf-arrow ml-2">→</span></button>
        <details className="group lg:col-span-12"><summary className="w-fit list-none text-sm font-semibold text-pitch underline decoration-strong underline-offset-4">Thêm bộ lọc</summary><div className="mt-4 grid gap-3 border-t border-hairline pt-4 sm:grid-cols-3"><label className="flex h-11 items-center gap-2 rounded-control border border-hairline px-3 text-sm"><input type="checkbox" name="available" value="1" defaultChecked={available === '1'} /> Chỉ hiện sân còn chỗ</label><select name="indoor" defaultValue={indoor ?? ''} aria-label="Loại sân" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Trong và ngoài nhà</option><option value="1">Trong nhà</option><option value="0">Ngoài trời</option></select><select name="sort" defaultValue={sort ?? 'name'} aria-label="Sắp xếp" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="name">Sắp xếp: Tên A–Z</option><option value="availability">Sắp xếp: Nhiều giờ trống</option><option value="price">Sắp xếp: Giá thấp trước</option></select></div></details>
      </form>

      {filtered && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-secondary">
          <span>Đang lọc:</span>
          {filters.map((f) => (
            <span key={f} className="rounded-pill bg-sunk px-3 py-1 text-sm text-ink">{f}</span>
          ))}
          <Link href="/tim-san" className="text-sm font-semibold text-pitch underline underline-offset-2">
            Bỏ lọc
          </Link>
        </p>
      )}

      <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">Danh sách sân</p><p className="mt-2 text-sm text-ink-secondary">{discovery.total ? `Hiển thị ${venues.length} trong ${discovery.total} cụm sân` : 'Không có kết quả phù hợp'}</p></div>{sort && <span className="hidden text-sm text-ink-secondary sm:inline">{sort === 'price' ? 'Giá thấp trước' : sort === 'availability' ? 'Nhiều giờ trống trước' : 'Tên A–Z'}</span>}</div>

      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((v) => {
          const sports = v.sports.map((s) => SPORT_LABELS[s] ?? s);
          const image = v.images?.[0] ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${v.images[0]}` : undefined;
          return (
            <li key={v.id} className="group flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-pitch">
              <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`}>
                <div className="relative"><div className="h-48 w-full bg-sunk bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.02]" style={image ? { backgroundImage: `url(${image})` } : undefined} />{!image && <div className="absolute inset-0 grid place-items-center bg-sunk text-xs text-ink-secondary">Chủ sân chưa thêm ảnh</div>}<div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" /><span className="absolute bottom-3 left-4 rounded-pill bg-white/90 px-2.5 py-1 text-xs font-semibold text-pitch">{v.available_slots > 0 ? 'Còn giờ hôm nay' : 'Hết giờ trống'}</span></div>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`} className="font-display text-xl font-bold tracking-tight text-pitch hover:underline">
                  {v.name}
                </Link>
                <span className="mt-1 text-sm text-ink-secondary">{v.district} · {v.address}</span>
                <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-pill bg-sunk px-2.5 py-1 text-xs text-ink-secondary">{sports.join(' · ')}</span><span className="rounded-pill bg-sunk px-2.5 py-1 text-xs text-ink-secondary">{v.court_count} sân</span></div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-hairline pt-4"><div><p className="text-xs text-ink-secondary">Giờ còn trống</p><p className="mt-1 font-semibold text-pitch">{v.available_slots > 0 ? v.available_slots : '—'}{v.next_slot && <span className="ml-1 text-xs font-normal text-ink-secondary">· {hhmm(v.next_slot)}</span>}</p></div><div><p className="text-xs text-ink-secondary">Giá từ</p><p className="mt-1 font-semibold text-pitch">{v.min_price ? `${vnd(v.min_price)}/giờ` : 'Chưa có'}</p></div></div>
                <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`} className="pf-action mt-5 inline-flex h-11 items-center justify-center rounded-control border border-pitch text-sm font-semibold text-pitch transition-colors hover:bg-pitch hover:text-pitch-ink">Xem lịch sân <span aria-hidden="true" className="pf-arrow ml-2">→</span></Link>
              </div>
            </li>
          );
        })}
      </ul>

      {discovery.pages > 1 && <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-2"><PaginationLink page={discovery.page - 1} disabled={discovery.page <= 1} params={{ sport, q, ngay: day, district, indoor, available, sort }} label="←" />{Array.from({ length: discovery.pages }, (_, i) => i + 1).slice(Math.max(0, discovery.page - 3), discovery.page + 2).map((n) => <PaginationLink key={n} page={n} params={{ sport, q, ngay: day, district, indoor, available, sort }} label={String(n)} active={n === discovery.page} />)}<PaginationLink page={discovery.page + 1} disabled={discovery.page >= discovery.pages} params={{ sport, q, ngay: day, district, indoor, available, sort }} label="→" /></nav>}

      {venues.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-card border border-hairline p-10 text-center">
          {filtered ? (
            <>
              <p className="text-sm text-ink-secondary">
                Không có cụm sân nào khớp {filters.join(' · ')}.
              </p>
              <Link href="/tim-san" className="text-sm font-semibold text-pitch underline underline-offset-2">
                Xem tất cả cụm sân
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink-secondary">
              Chưa có cụm sân nào. Chạy <code>supabase/04_seed.sql</code> để có dữ liệu mẫu.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function PaginationLink({ page, params, label, disabled, active }: { page: number; params: Record<string | number, string | undefined>; label: string; disabled?: boolean; active?: boolean }) {
  const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, value]) => value));
  return disabled ? <span aria-hidden="true" className="grid size-10 place-items-center rounded-control border border-hairline text-ink-secondary/40">{label}</span> : <Link aria-current={active ? 'page' : undefined} href={`/tim-san?${query}`} className={`grid size-10 place-items-center rounded-control border text-sm font-semibold ${active ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card'}`}>{label}</Link>;
}
