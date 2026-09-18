import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PitchThumb } from '@/components/pitch-thumb';
import { SPORT_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  address: string;
  district: string;
  phone: string | null;
  amenities: string[];
  courts: { sport: string }[];
};

/**
 * Danh sách sân. ?sport= và ?q= từ thanh tìm kiếm trang chủ lọc thật:
 * môn lọc ở tầng database (inner join sang courts), khu vực lọc trên tên,
 * địa chỉ và quận. Không có kết quả thì nói rõ đã lọc gì, kèm đường về.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; q?: string; ngay?: string }>;
}) {
  const { sport, q, ngay } = await searchParams;
  const supabase = await createClient();

  const validSport = sport && sport in SPORT_LABELS ? sport : undefined;
  const term = q?.trim();
  // Ngày chỉ đi kèm sang trang sân để lịch mở đúng hôm đó — không lọc gì ở đây.
  const day = ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? ngay : undefined;

  // !inner: chỉ giữ cụm sân thật sự có sân con đang mở của môn đó.
  let query = supabase
    .from('venues')
    .select(
      validSport
        ? 'id, slug, name, address, district, phone, amenities, courts!inner(sport)'
        : 'id, slug, name, address, district, phone, amenities, courts(sport)'
    )
    .eq('status', 'active');

  if (validSport) {
    query = query.eq('courts.sport', validSport).eq('courts.is_active', true);
  }
  if (term) {
    const safe = term.replace(/[%,()]/g, ' ');
    query = query.or(`name.ilike.%${safe}%,address.ilike.%${safe}%,district.ilike.%${safe}%`);
  }

  const { data } = await query.order('name');
  const venues = (data ?? []) as unknown as VenueRow[];

  const filters = [validSport && SPORT_LABELS[validSport], term].filter(Boolean) as string[];
  const filtered = filters.length > 0;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">
        {venues.length} cụm sân ở Hà Nội
      </h1>

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
          const sports = [...new Set((v.courts ?? []).map((c) => SPORT_LABELS[c.sport] ?? c.sport))];
          return (
            <li key={v.id} className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-strong">
              <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`}>
                <PitchThumb width="100%" height={132} />
              </Link>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <Link href={day ? `/san/${v.slug}?ngay=${day}` : `/san/${v.slug}`} className="font-semibold hover:underline">
                  {v.name}
                </Link>
                <span className="text-sm text-ink-secondary">{v.address} · {v.district}</span>
                <span className="mt-1 text-sm text-ink-secondary">{sports.join(', ')}</span>
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="mt-2 w-fit text-sm font-semibold text-pitch underline underline-offset-2">
                    Gọi chủ sân · {v.phone}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

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
