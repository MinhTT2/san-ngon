import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PitchThumb } from '@/components/pitch-thumb';
import { PEAK_FROM_HOUR, PEAK_TO_HOUR, SPORT_LABELS } from '@/lib/constants';
import { dayLabel, hhmm, ymd } from '@/lib/format';

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

type FreeSlots = {
  venue_id: string;
  con_trong: number;
  con_trong_gio_vang: number;
  som_nhat: string | null;
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

  // Một lượt cho cả trang. Không có sân nào thì bỏ qua luôn, đừng gọi RPC với
  // mảng rỗng chỉ để nhận lại mảng rỗng.
  const today = ymd(new Date());
  const forDay = day ?? today;
  const free = new Map<string, FreeSlots>();
  if (venues.length > 0) {
    const { data: rows } = await supabase.rpc('venues_free_slots', {
      p_venue_ids: venues.map((v) => v.id),
      p_date: forDay,
      p_peak_from: PEAK_FROM_HOUR,
      p_peak_to: PEAK_TO_HOUR,
    });
    for (const row of (rows ?? []) as FreeSlots[]) free.set(row.venue_id, row);
  }
  const dayWord = forDay === today ? 'hôm nay' : dayLabel(new Date(`${forDay}T12:00:00+07:00`)).toLowerCase();

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
                <FreeSlotsLine free={free.get(v.id)} dayWord={dayWord} />
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

/**
 * Còn bao nhiêu khung trống — lời hứa ngoài trang chủ, giờ nói ngay trên thẻ.
 *
 * Ưu tiên khoe giờ vàng vì đó là khung người ta tìm; hết giờ vàng thì vẫn nói
 * còn chỗ lúc nào, và hết sạch thì nói thẳng để khỏi bấm vào rồi thất vọng.
 */
function FreeSlotsLine({ free, dayWord }: { free?: FreeSlots; dayWord: string }) {
  if (!free) return null;

  if (free.con_trong === 0) {
    return (
      <span className="mt-2 w-fit rounded-pill border border-hairline bg-sunk px-2.5 py-1 text-xs font-semibold text-taken-ink">
        Hết chỗ {dayWord}
      </span>
    );
  }

  if (free.con_trong_gio_vang > 0) {
    return (
      <span className="mt-2 w-fit rounded-pill border border-peak-line bg-peak-fill px-2.5 py-1 text-xs font-semibold text-peak-ink">
        Còn {free.con_trong_gio_vang} khung giờ vàng {dayWord}
      </span>
    );
  }

  return (
    <span className="mt-2 w-fit rounded-pill border border-free-line bg-free-fill px-2.5 py-1 text-xs font-semibold text-free-ink">
      Còn {free.con_trong} khung {dayWord}
      {free.som_nhat ? ` · sớm nhất ${hhmm(free.som_nhat)}` : ''}
    </span>
  );
}
