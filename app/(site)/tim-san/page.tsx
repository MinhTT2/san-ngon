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
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">
        {discovery.total} cụm sân ở Hà Nội
      </h1>

      <form action="/tim-san" className="mt-5 grid gap-3 rounded-card border border-hairline bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Tên sân, đường, quận" aria-label="Tìm cụm sân" className="h-11 rounded-control border border-hairline bg-page px-3 text-sm lg:col-span-2" />
        <select name="sport" defaultValue={sport ?? ''} aria-label="Môn thể thao" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả môn</option>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select name="district" defaultValue={district ?? ''} aria-label="Quận huyện" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Tất cả quận/huyện</option>{DISTRICTS.map((item) => <option key={item}>{item}</option>)}</select>
        <input name="ngay" type="date" defaultValue={day} aria-label="Ngày chơi" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" value="1" defaultChecked={available === '1'} /> Chỉ còn chỗ</label>
        <select name="indoor" defaultValue={indoor ?? ''} aria-label="Loại sân" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="">Trong và ngoài nhà</option><option value="1">Trong nhà</option><option value="0">Ngoài trời</option></select>
        <select name="sort" defaultValue={sort ?? 'name'} aria-label="Sắp xếp" className="h-11 rounded-control border border-hairline bg-page px-2 text-sm"><option value="name">Tên A–Z</option><option value="availability">Nhiều giờ trống</option><option value="price">Giá thấp trước</option></select>
        <button className="h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink">Lọc sân</button>
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

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((v) => {
          const sports = v.sports.map((s) => SPORT_LABELS[s] ?? s);
          const image = v.images?.[0] ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${v.images[0]}` : undefined;
          return (
            <li key={v.id} className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-strong">
              <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`}>
                <div className="relative"><div className="h-36 w-full bg-sunk bg-cover bg-center" style={image ? { backgroundImage: `url(${image})` } : undefined} />{!image && <div className="absolute inset-0 grid place-items-center text-xs text-ink-secondary">Chủ sân chưa thêm ảnh</div>}</div>
              </Link>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`} className="font-semibold hover:underline">
                  {v.name}
                </Link>
                <span className="text-sm text-ink-secondary">{v.address} · {v.district}</span>
                <span className="mt-1 text-sm text-ink-secondary">{sports.join(', ')} · {v.court_count} sân</span>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-hairline pt-3"><span className="text-xs text-ink-secondary">{v.available_slots > 0 ? `${v.available_slots} khung còn trống${v.next_slot ? ` · gần nhất ${hhmm(v.next_slot)}` : ''}` : 'Chưa có khung trống'}</span><span className="text-sm font-semibold text-pitch">{v.min_price ? `Từ ${vnd(v.min_price)}/giờ` : 'Chưa có giá'}</span></div>
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
