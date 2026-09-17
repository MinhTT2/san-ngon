import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PitchThumb } from '@/components/pitch-thumb';
import { SPORT_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Danh sách sân. Bộ lọc đã cắt khỏi MVP — năm cụm sân thì không ai cần lọc.
 * Tham số ?sport= và ?q= từ thanh tìm kiếm ở trang chủ hiện chỉ dùng để hiển thị
 * lại trên tiêu đề. Nối vào truy vấn khi có đủ sân để việc lọc có nghĩa.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; q?: string }>;
}) {
  const { sport, q } = await searchParams;
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from('venues')
    .select('id, slug, name, address, district, amenities, courts(sport)')
    .eq('status', 'active')
    .order('name');

  const label = [SPORT_LABELS[sport ?? ''], q].filter(Boolean).join(' · ');

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">
        {(venues ?? []).length} cụm sân ở Hà Nội
      </h1>
      {label && <p className="mt-2 text-ink-secondary">Đang xem: {label}</p>}

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(venues ?? []).map((v) => {
          const courts = (v.courts ?? []) as unknown as { sport: string }[];
          const sports = [...new Set(courts.map((c) => SPORT_LABELS[c.sport] ?? c.sport))];
          return (
            <li key={v.id}>
              <Link
                href={`/san/${v.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-strong"
              >
                <PitchThumb width="100%" height={132} />
                <div className="flex flex-col gap-1.5 p-4">
                  <span className="font-semibold">{v.name}</span>
                  <span className="text-sm text-ink-secondary">{v.address} · {v.district}</span>
                  <span className="mt-1 text-sm text-ink-secondary">{sports.join(', ')}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {(venues ?? []).length === 0 && (
        <p className="mt-8 rounded-card border border-hairline p-10 text-center text-sm text-ink-secondary">
          Chưa có cụm sân nào. Chạy <code>supabase/04_seed.sql</code> để có dữ liệu mẫu.
        </p>
      )}
    </main>
  );
}
