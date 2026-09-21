import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroCarousel } from '@/components/hero-carousel';
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
    'Tìm sân bóng, cầu lông, pickleball, tennis còn chỗ ở Hà Nội. Xem lịch, biết giá, đặt cọc dễ dàng bằng chuyển khoản.',
  openGraph: {
    title: 'Tối nay chơi gì? Chọn sân, hẹn bạn, lên đường',
    description: 'Chọn sân gần bạn, giữ giờ đẹp, cọc nhanh qua QR — phần còn lại thanh toán tại sân.',
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

  const [{ count: venueCount }, { count: courtCount }, { data: districts }, { data: featured }] =
    await Promise.all([
      supabase.from('venues').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('courts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('venues').select('district').eq('status', 'active'),
      supabase.from('venues').select('id, slug, name').eq('status', 'active').order('name').limit(1).maybeSingle(),
    ]);

  const districtCount = new Set((districts ?? []).map((d) => d.district)).size;
  const hero = featured ? await loadHeroSlots(supabase, featured.id) : null;

  return (
    <>
      <Hero
        grid={
          hero && featured ? (
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
      {venueCount ? (
        <Reveal>
          <Stats venues={venueCount} courts={courtCount ?? 0} districts={districtCount} />
        </Reveal>
      ) : null}
      <Reveal><HowItWorks /></Reveal>
      <Reveal><WhyDeposit /></Reveal>
      <Reveal><ForOwners /></Reveal>
      <Reveal><Faq /></Reveal>
    </>
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
    const { data } = await supabase.rpc('get_venue_availability', {
      p_venue_id: venueId,
      p_date: ymd(date),
    });

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
    <section className="bg-pitch">
      <h1 className="sr-only">Sân Ngon — Đặt sân thể thao ở Hà Nội</h1>
      <HeroCarousel />
      <div className="border-t border-hairline bg-free-fill">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-16">
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">Chọn sân cho cuộc vui sắp tới</h2>
            <SearchBar />
            <p className="text-xs leading-5 text-ink-secondary">Tìm sân miễn phí · Chỉ cần đăng nhập khi đặt</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">Xem giờ sân còn trống</h2>
            {grid}
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchBar() {
  // Không cho chọn ngày đã qua; chân trời đặt trước do từng cụm sân quyết định
  // nên chỉ chặn mốc dưới ở đây.
  const today = ymd(new Date());

  // Hai cột trên desktop, một cột trên điện thoại để các ô nhập đủ rộng.
  return (
    <form action="/tim-san" className="grid grid-cols-1 gap-2.5 rounded-card bg-card p-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="sport" className="text-xs font-semibold text-ink-secondary">Môn</label>
        <select id="sport" name="sport" defaultValue="" className="h-12 rounded-[9px] border border-hairline bg-page px-2.5 text-[15px]">
          {/* Rỗng = mọi môn. Bỏ mục này thì ai bấm luôn cũng bị lọc về bóng đá 5. */}
          <option value="">Tất cả các môn</option>
          {Object.entries(SPORT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="q" className="text-xs font-semibold text-ink-secondary">Khu vực</label>
        <input id="q" name="q" placeholder="Nam Từ Liêm" className="h-12 rounded-[9px] border border-hairline bg-page px-3 text-[15px]" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="ngay" className="text-xs font-semibold text-ink-secondary">Ngày</label>
        <input id="ngay" name="ngay" type="date" min={today} defaultValue={today}
          className="h-12 rounded-[9px] border border-hairline bg-page px-2.5 text-[15px]" />
      </div>
      <button type="submit" className="mt-1 h-12 self-end rounded-[9px] bg-pitch px-6 text-[15px] font-semibold text-pitch-ink">
        Xem sân trống
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
    { title: 'Lịch rõ. Giá rõ.', body: 'Xem giờ còn trống và mức giá ngay trên lịch sân.', color: 'bg-story-teal', label: '01 / Chọn giờ' },
    { title: 'Giữ chỗ cho cả đội.', body: 'Chọn giờ, điền thông tin. Sân được giữ cho bạn 15 phút để chuyển cọc.', color: 'bg-story-lilac', label: '02 / Giữ chỗ' },
    { title: 'Chốt kèo. Lên sân.', body: 'Cọc qua QR, nhận xác nhận rồi rủ cả đội lên sân.', color: 'bg-story-coral', label: '03 / Sẵn sàng chơi' },
  ];

  return (
    <section id="cach-hoat-dong" className="mx-auto max-w-7xl px-5 py-20 lg:px-16 lg:py-24">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">Bớt hẹn qua điện thoại</p>
          <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">Ba bước đặt sân.<br /><span className="text-pitch">Còn lại là cuộc vui.</span></h2>
        </div>
        <Link href="/tim-san" className="inline-flex min-h-11 items-center gap-5 self-start border-b border-pitch pb-2 text-sm font-semibold text-pitch lg:self-end">
          Tìm sân cho kèo tiếp theo <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {steps.map(({ title, body, color, label }, i) => (
          <Reveal key={title} delay={i * 90} className="flex">
            <article className={`flex w-full flex-col overflow-hidden rounded-[24px] border border-ink/10 ${color}`}>
              <div className="px-7 pt-7">
                <p className="text-xs font-semibold uppercase tracking-widest text-pitch">{label}</p>
                <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">{title}</h3>
                <p className="mt-3 min-h-20 text-sm leading-6 text-ink-secondary">{body}</p>
              </div>
              <div className="mx-5 mb-5 mt-6 flex min-h-48 flex-1 flex-col justify-center rounded-[18px] border border-white/70 bg-white/75 p-5">
                {i === 0 ? (
                  <>
                    <div className="mb-4 flex items-center justify-between text-xs"><span className="font-semibold">Giờ còn trống</span><span className="text-ink-secondary">Minh họa</span></div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {['17:00', '18:00', '19:00'].map((time) => <span key={time} className="pb-1 text-ink-secondary">{time}</span>)}
                      {['Trống', 'Đã đặt', 'Trống', 'Đã đặt', 'Trống', 'Trống'].map((status, slot) => (
                        <span key={slot} className={`rounded-slot border py-3 ${status === 'Trống' ? 'border-free-line bg-free-fill text-free-ink' : 'border-hairline bg-taken-fill text-taken-ink'}`}>{status}</span>
                      ))}
                    </div>
                  </>
                ) : i === 1 ? (
                  <>
                    <span className="text-xs font-medium text-ink-secondary">Bạn có thời gian chuyển cọc</span>
                    <p className="my-3 font-display text-6xl font-extrabold tracking-tight text-pitch">15<span className="ml-2 text-lg font-medium">phút</span></p>
                    <p className="border-t border-strong pt-3 text-xs leading-5 text-ink-secondary">Mở ứng dụng ngân hàng và hoàn tất trong vài bước.</p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pitch text-2xl text-white" aria-hidden="true">✓</div>
                    <span className="font-display text-2xl font-bold text-pitch">Hẹn nhau ở sân!</span>
                    <p className="mt-2 text-xs leading-5 text-ink-secondary">Nhận xác nhận đặt sân, yên tâm hẹn cả đội.</p>
                  </>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function WhyDeposit() {
  return (
    <section className="mx-auto max-w-7xl px-5 lg:px-16">
      <div className="grid overflow-hidden rounded-[28px] bg-pitch lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-between gap-10 p-7 text-white sm:p-10 lg:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-free-line">Một khoản cọc. Một lời hẹn.</p>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Sân giữ cho bạn.<br />Bạn giữ lời hẹn.</h2>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-free-fill">Cọc trước một phần để chủ sân giữ đúng khung giờ cho cả đội. Phần còn lại, thanh toán khi tới sân.</p>
          </div>
          <div className="grid grid-cols-[3fr_7fr] gap-2" aria-label="Ví dụ: cọc trước 30%, trả tại sân 70%">
            <div className="border-t-4 border-free-line pt-4"><p className="font-display text-4xl font-bold">30<span className="text-xl">%</span></p><p className="mt-1 text-xs text-free-line">Cọc trước</p></div>
            <div className="border-t-4 border-white/25 pt-4"><p className="font-display text-4xl font-bold">70<span className="text-xl">%</span></p><p className="mt-1 text-xs text-free-line">Trả tại sân</p></div>
          </div>
          <p className="text-xs leading-5 text-free-line">Tỷ lệ minh họa. Mức cọc cụ thể được hiển thị khi đặt từng sân.</p>
        </div>
        <div className="flex items-center bg-free-line/10 p-5 sm:p-10 lg:p-12">
          <div className="w-full rounded-[20px] bg-page p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-strong pb-6">
              <div><p className="text-xs uppercase tracking-widest text-ink-secondary">Chia tiền thật dễ</p><h3 className="mt-2 font-display text-2xl font-bold">Một buổi bóng đá</h3><p className="mt-2 text-sm text-ink-secondary">2 tiếng · 10 người · Ví dụ</p></div>
              <span aria-hidden="true" className="text-3xl text-pitch">↗</span>
            </div>
            <div className="space-y-4 py-6 text-sm">
              <Line label="Tổng tiền sân" value="700.000đ" />
              <Line label="Cọc trước qua QR" value="210.000đ" />
              <Line label="Trả tại sân" value="490.000đ" />
            </div>
            <div className="rounded-control bg-story-teal p-5">
              <p className="text-xs font-medium text-pitch">Mỗi người chỉ cần góp trước</p>
              <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-pitch">21.000<span className="ml-1 text-xl">đ</span></p>
              <p className="mt-2 text-xs text-ink-secondary">Và 49.000đ khi tới sân.</p>
            </div>
            <Link href="/chinh-sach-huy" className="mt-5 inline-flex min-h-11 items-center gap-3 text-xs font-semibold text-pitch underline underline-offset-4">Xem chính sách hủy và hoàn cọc <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ForOwners() {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-16 lg:px-16 lg:pt-24">
      <div className="relative grid min-h-[620px] overflow-hidden rounded-[28px] bg-pitch lg:min-h-[560px] lg:grid-cols-2">
        {/* Nguồn: Mixkit, clip miễn phí "One on one in a soccer game". */}
        <video className="pf-ambient-video absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/videos/soccer-poster.svg" aria-hidden="true">
          <source src="/videos/soccer-one-on-one.mp4" type="video/mp4" />
        </video>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-pitch via-pitch/80 to-pitch/30" />
        <div className="relative z-10 flex flex-col justify-center p-7 text-white sm:p-10 lg:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-free-line">Dành cho chủ sân</p>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Bạn chăm sân.<br />Khách tự chốt kèo.</h2>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-free-fill">Đang ngoài sân, tay bận, trời ồn? Để khách tự xem lịch và đặt chỗ. Bạn biết ngay khi có khách, nắm lịch và khoản cần thu thật gọn.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/dang-ky-san" className="inline-flex min-h-12 items-center gap-5 rounded-control bg-free-fill px-6 py-3 text-sm font-semibold text-pitch transition-colors hover:bg-white">Đăng sân của bạn <span aria-hidden="true">↗</span></Link>
            <Link href="/chu-san" className="inline-flex min-h-11 items-center border-b border-white/40 text-sm font-semibold text-white">Mở trang dành cho chủ sân</Link>
          </div>
        </div>
        <div className="relative z-10 flex flex-col justify-center gap-4 p-5 sm:p-10 lg:pl-0 lg:pr-12 lg:py-12">
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
            <div><p className="text-sm font-semibold">Có khách đặt. Bạn biết ngay.</p><p className="mt-1 text-xs leading-5 text-free-line">Biết giờ nào đã có khách, khoản nào cần thu tại sân.</p></div>
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
    ['Tôi có cần trả hết tiền khi đặt không?', 'Bạn chỉ cần cọc trước một phần, phần còn lại trả tại sân. Tiền cọc và tổng tiền đều được ghi rõ trước khi bạn chuyển khoản.'],
    ['Đặt xong mà không chuyển khoản?', 'Sau 15 phút, chỗ giữ tạm hết hạn và giờ đó mở lại cho người khác. Bạn không mất phí.'],
  ];

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-16 lg:py-24">
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">Trước khi ra sân</p>
        <h2 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">Bạn hỏi.<br />Sân Ngon trả lời.</h2>
        <p className="mt-5 max-w-xs text-sm leading-6 text-ink-secondary">Một vài điều nhỏ để buổi chơi diễn ra suôn sẻ.</p>
        <Link href="/lien-he" className="mt-5 inline-flex min-h-11 items-center gap-4 text-sm font-semibold text-pitch underline underline-offset-4">Cần hỗ trợ thêm <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="divide-y divide-hairline border-y border-hairline">
        {qa.map(([q, a], i) => (
          <details key={q} open={i === 0} className="group">
            <summary className="flex list-none items-start gap-4 py-6 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pitch [&::-webkit-details-marker]:hidden">
              <span className="pt-0.5 text-xs font-normal tabular-nums text-ink-secondary">0{i + 1}</span>
              <span className="flex-1">{q}</span>
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-strong text-pitch transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
            </summary>
            <p className="pb-6 pl-8 pr-8 text-sm leading-7 text-ink-secondary">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
