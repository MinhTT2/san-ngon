import type { Metadata } from 'next';
import Link from 'next/link';
import { QueryError } from '@/components/query-error';
import { HeroCarousel } from '@/components/hero-carousel';
import { AmbientVideo } from '@/components/ambient-video';
import { HeroGrid, HeroGridPlaceholder } from '@/components/hero-grid';
import { Reveal } from '@/components/reveal';
import { CountUp } from '@/components/count-up';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { ymd } from '@/lib/format';
import type { Slot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sân Ngon — Đặt sân thể thao ở Hà Nội',
  description:
    'Tìm sân bóng, cầu lông, pickleball còn chỗ ở Hà Nội. Xem lịch, biết giá, đặt cọc dễ dàng bằng chuyển khoản.',
  openGraph: {
    title: 'Tối nay chơi gì? Chọn sân, hẹn bạn, lên đường',
    description: 'Chọn sân gần bạn, giữ giờ đẹp, cọc 100% qua QR, thanh toán trọn tiền sân khi đặt.',
    locale: 'vi_VN',
    type: 'website',
  },
};

/** Lưới hero chỉ vừa 2 sân × 6 khung giờ — rộng hơn là chữ bé không đọc được. */
const HERO_COURTS = 2;
const HERO_TIMES = 6;

/**
 * Landing page. Hero cho xem chính cái lưới lịch chứ không phải ảnh minh họa —
 * người vào trang chỉ có đúng một câu hỏi: tối nay còn sân không, mấy giờ, bao tiền.
 *
 * Số liệu ở khối thống kê đọc từ database thật, không hardcode. Chưa có sân thì
 * khối đó tự ẩn — số nhỏ mà thật vẫn hơn số to mà bịa.
 */
export default async function Page() {
  const supabase = await createClient();

  const [{ count: venueCount, error: venuesError }, { count: courtCount, error: courtsError }, { data: districts, error: districtsError }, { data: featured, error: featuredError }] =
    await Promise.all([
      supabase.from('venues').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('courts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('venues').select('district').eq('status', 'active'),
      supabase.from('venues').select('id, slug, name').eq('status', 'active').order('name').limit(1).maybeSingle(),
    ]);

  const districtCount = new Set((districts ?? []).map((d) => d.district)).size;
  const statsUnavailable = venuesError || courtsError || districtsError || venueCount === null || courtCount === null;
  let hero: Awaited<ReturnType<typeof loadHeroSlots>> = null;
  let heroUnavailable = Boolean(featuredError);
  if (featured && !featuredError) {
    try { hero = await loadHeroSlots(supabase, featured.id); }
    catch { heroUnavailable = true; }
  }

  return (
    <main>
      <Hero
        grid={
          heroUnavailable ? <QueryError title="Chưa tải được lịch sân" /> : hero && featured ? (
            <HeroGrid
              venueName={featured.name}
              venueSlug={featured.slug}
              date={hero.date}
              slots={hero.slots}
              tomorrow={hero.tomorrow}
            />
          ) : (
            <HeroGridPlaceholder />
          )
        }
      />
      {statsUnavailable ? <div className="mx-auto max-w-7xl px-5 py-6 lg:px-16"><QueryError title="Chưa tải được số liệu sân" /></div> : venueCount ? (
        <Reveal>
          <Stats venues={venueCount} courts={courtCount ?? 0} districts={districtCount} />
        </Reveal>
      ) : null}
      <HowItWorks />
      <Reveal><WhyDeposit /></Reveal>
      <Reveal><ForOwners /></Reveal>
      <Reveal><Faq /></Reveal>
    </main>
  );
}

/**
 * Khung giờ cho lưới hero: lấy các khung còn CHƯA QUA của hôm nay; muộn quá
 * rồi thì nhảy sang ngày mai, vì một lưới toàn ô xám không bán được gì.
 */
async function loadHeroSlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string
): Promise<{ slots: Slot[]; date: Date; tomorrow: boolean } | null> {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const [date, isTomorrow] of [[today, false], [tomorrow, true]] as const) {
    const { data, error } = await supabase.rpc('get_venue_availability', {
      p_venue_id: venueId,
      p_date: ymd(date),
    });

    if (error) throw new Error('Không tải được lịch sân.');
    const upcoming = ((data ?? []) as Slot[]).filter((s) => new Date(s.starts_at) > new Date());
    if (upcoming.length === 0) continue;

    const times = [...new Set(upcoming.map((s) => s.starts_at))].sort().slice(0, HERO_TIMES);
    const courtIds = [...new Set(upcoming.map((s) => s.court_id))].slice(0, HERO_COURTS);
    const timeSet = new Set(times);
    const courtSet = new Set(courtIds);

    return {
      slots: upcoming.filter((s) => timeSet.has(s.starts_at) && courtSet.has(s.court_id)),
      date,
      tomorrow: isTomorrow,
    };
  }

  return null;
}

function Hero({ grid }: { grid: React.ReactNode }) {
  return (
    <section>
      <div className="border-b border-hairline bg-free-fill">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-16 lg:py-9">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Đặt sân thể thao ở Hà Nội</p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-pitch sm:text-5xl">Tìm sân trống.<br />Chọn giờ, ra sân.</h1>
            <p className="text-sm leading-6 text-ink-secondary">Xem lịch và giá trước khi đặt. Cọc 100% qua QR, thanh toán trọn tiền sân khi đặt.</p>
            <SearchBar />
            <p className="text-xs leading-5 text-ink-secondary">Tìm sân miễn phí · Chỉ cần đăng nhập khi đặt</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">Xem nhanh lịch sân</h2>
            {grid}
            <Link href="/tim-san" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-pitch underline underline-offset-4">Xem tất cả sân <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
      <HeroCarousel />
    </section>
  );
}

function SearchBar() {
  // Không cho chọn ngày đã qua; chân trời đặt trước do từng cụm sân quyết định
  // nên chỉ chặn mốc dưới ở đây.
  const today = ymd(new Date());

  // Hai cột trên desktop, một cột trên điện thoại để các ô nhập đủ rộng.
  return (
    <form action="/tim-san" className="grid grid-cols-1 gap-2.5 rounded-card border border-strong bg-card p-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="sport" className="text-xs font-semibold text-ink-secondary">Môn thể thao</label>
        <select id="sport" name="sport" defaultValue="" className="h-12 rounded-[9px] border border-hairline bg-page px-2.5 text-[15px]">
          {/* Rỗng = mọi môn. Bỏ mục này thì ai bấm luôn cũng bị lọc về bóng đá 5. */}
          <option value="">Tất cả các môn</option>
          {Object.entries(SPORT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="q" className="text-xs font-semibold text-ink-secondary">Tên sân hoặc khu vực</label>
        <input id="q" name="q" placeholder="VD: Cầu Giấy" className="h-12 rounded-[9px] border border-hairline bg-page px-3 text-[15px]" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="ngay" className="text-xs font-semibold text-ink-secondary">Ngày chơi</label>
        <input id="ngay" name="ngay" type="date" min={today} defaultValue={today}
          className="h-12 rounded-[9px] border border-hairline bg-page px-2.5 text-[15px]" />
      </div>
      <button type="submit" className="pf-action mt-1 h-11 self-end rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink hover:bg-ink">
        Xem sân trống <span className="pf-arrow ml-2" aria-hidden="true">→</span>
      </button>
    </form>
  );
}

function Stats({ venues, courts, districts }: { venues: number; courts: number; districts: number }) {
  const items: [number, string, string][] = [
    [venues, '', 'cụm sân đang nhận đặt'],
    [courts, '', 'sân cho bạn lựa chọn'],
    [districts, '', 'quận có sân'],
    [15, ' phút', 'giữ chỗ để bạn chuyển cọc'],
  ];
  return (
    <section className="border-b border-hairline bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-7 lg:grid-cols-4 lg:px-16">
        {items.map(([value, suffix, label]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <CountUp to={value} suffix={suffix} className="font-display text-2xl font-bold text-pitch" />
            <span className="text-[13px] text-ink-secondary">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['Chọn sân và giờ chơi', 'Lọc theo môn, khu vực và ngày. Mở lịch để xem khung trống và tổng tiền.'],
    ['Điền thông tin đặt sân', 'Kiểm tra sân, thời lượng, họ tên và số điện thoại. Giữ chỗ trong 15 phút.'],
    ['Chuyển khoản theo mã đơn', 'Quét QR và chuyển đúng số tiền. Đơn tự xác nhận khi hệ thống nhận được tiền.'],
  ];
  return <section id="cach-hoat-dong" className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-16 lg:py-16">
    <div><h2 className="font-display text-2xl font-bold tracking-tight text-pitch">Cách đặt sân</h2><p className="mt-3 text-sm leading-6 text-ink-secondary">Bạn có thể xem lịch mà chưa cần đăng nhập.</p><Link href="/tim-san" className="pf-action mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch underline underline-offset-4">Tìm sân <span className="pf-arrow" aria-hidden="true">→</span></Link></div>
    <ol className="divide-y divide-hairline border-y border-hairline">{steps.map(([title, body], index) => <li key={title}><Reveal delay={index * 70} className="flex items-start gap-5 py-5"><span className="mt-0.5 text-sm tabular-nums text-ink-secondary">0{index + 1}</span><div><h3 className="text-base font-semibold text-pitch">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-secondary">{body}</p></div></Reveal></li>)}</ol>
  </section>;
}

function WhyDeposit() {
  return <section className="mx-auto max-w-7xl px-5 lg:px-16">
    <div className="grid gap-6 border-y border-hairline bg-free-fill px-5 py-7 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
      <h2 className="font-display text-2xl font-bold tracking-tight text-pitch">Thanh toán khi đặt sân</h2>
      <div><p className="text-sm leading-7 text-ink">Thanh toán trước 100% tiền sân bằng chuyển khoản. Tổng tiền và tài khoản nhận được ghi trên từng đơn; bạn không cần trả thêm tiền sân khi đến.</p><p className="mt-3 text-xs leading-6 text-ink-secondary">Chỗ giữ tạm hết hạn sau 15 phút nếu chưa thanh toán. Điều kiện hủy và hoàn cọc được hiển thị trước khi xác nhận.</p><Link href="/chinh-sach-huy" className="pf-action mt-2 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-pitch underline underline-offset-4">Chính sách hủy và hoàn cọc <span className="pf-arrow" aria-hidden="true">→</span></Link></div>
    </div>
  </section>;
}

function ForOwners() {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-16 lg:px-16 lg:pt-24">
      <div className="relative grid min-h-[400px] pb-6 lg:pb-0 overflow-hidden rounded-[28px] bg-pitch lg:min-h-[400px] lg:grid-cols-2">
        <AmbientVideo />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-pitch via-pitch/80 to-pitch/30" />
        <div className="relative z-10 flex flex-col justify-center p-7 text-white sm:p-10 lg:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-free-line">Dành cho chủ sân</p>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Quản lý lịch và đơn đặt sân</h2>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-free-fill">Khách tự xem lịch và chuyển khoản khi đặt. Bạn theo dõi đơn, khóa giờ bận và kiểm tra tiền cọc trong trang quản lý.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/dang-ky-san" className="pf-action inline-flex min-h-11 items-center gap-3 rounded-control bg-free-fill px-4 py-2 text-sm font-semibold text-pitch transition-colors hover:bg-white">Đăng ký làm chủ sân <span aria-hidden="true" className="pf-arrow">↗</span></Link>
            <Link href="/chu-san" className="pf-action inline-flex min-h-11 items-center border-b border-white/40 text-sm font-semibold text-white">Mở trang dành cho chủ sân</Link>
          </div>
        </div>
        <div className="relative z-10 flex flex-col justify-center gap-4 p-5 sm:p-10 lg:pl-0 lg:pr-12 lg:py-9">
          <div className="rounded-[20px] border border-white bg-card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3 border-b border-hairline pb-5"><span className="font-display text-xl font-bold">Lịch sân trong ngày</span><span className="rounded-pill bg-sunk px-3 py-1 text-xs text-ink-secondary">Ví dụ</span></div>
            <div className="divide-y divide-hairline">
              {[
                ['18:00', 'Sân bóng 01', 'Đã xác nhận'],
                ['19:00', 'Sân cầu lông 02', 'Đã xác nhận'],
                ['20:00', 'Sân pickleball 01', 'Còn trống'],
              ].map(([time, court, status]) => (
                <div key={time} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-5">
                  <span className="font-display text-xl font-bold tabular-nums text-pitch">{time}</span>
                  <span className="flex-1 text-sm font-medium">{court}</span>
                  <span className="text-xs text-ink-secondary">{status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-[18px] bg-pitch p-5 text-white sm:ml-10">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-free-line/40 text-xl">✓</span>
            <div><p className="text-sm font-semibold">Đơn mới tự cập nhật trong lịch.</p><p className="mt-1 text-xs leading-5 text-free-line">Hệ thống đối soát chuyển khoản và cập nhật trạng thái cọc.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const qa = [
    ['Xem lịch có phải đăng nhập không?', 'Không. Bạn cứ xem lịch thoải mái; chỉ cần đăng nhập khi đặt để giữ chỗ và nhận hỗ trợ khi cần.'],
    ['Trời mưa không chơi được thì sao?', 'Liên hệ chủ sân để được hỗ trợ. Việc đổi giờ hoặc hoàn cọc tùy theo chính sách của từng sân.'],
    ['Tôi có cần trả hết tiền khi đặt không?', 'Có. Bạn cọc trước 100% tiền sân qua chuyển khoản. Tổng tiền được ghi rõ trước khi thanh toán và không còn tiền sân phải trả khi đến.'],
    ['Đặt xong mà không chuyển khoản?', 'Sau 15 phút, chỗ giữ tạm hết hạn và giờ đó mở lại cho người khác. Bạn không mất phí.'],
  ];

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-16 lg:py-16">
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">Trước khi ra sân</p>
        <h2 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Câu hỏi thường gặp</h2>
        <p className="mt-5 max-w-xs text-sm leading-6 text-ink-secondary">Thông tin về xem lịch, thanh toán và hủy đơn.</p>
        <Link href="/lien-he" className="pf-action mt-5 inline-flex min-h-11 items-center gap-4 text-sm font-semibold text-pitch underline underline-offset-4">Cần hỗ trợ thêm <span aria-hidden="true" className="pf-arrow">↗</span></Link>
      </div>
      <div className="divide-y divide-hairline border-y border-hairline">
        {qa.map(([q, a], i) => (
          <details key={q} open={i === 0} className="group">
            <summary className="flex list-none items-start gap-4 py-6 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pitch [&::-webkit-details-marker]:hidden">
              <span className="pt-0.5 text-xs font-normal tabular-nums text-ink-secondary">0{i + 1}</span>
              <span className="flex-1">{q}</span>
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-strong text-pitch transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
            </summary>
            <p className="pf-details-content pb-6 pl-8 pr-8 text-sm leading-7 text-ink-secondary">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
