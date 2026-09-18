import type { Metadata } from 'next';
import Link from 'next/link';
import { PitchNight } from '@/components/pitch-night';
import { HeroGrid, HeroGridPlaceholder } from '@/components/hero-grid';
import { Reveal } from '@/components/reveal';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { ymd } from '@/lib/format';
import type { Slot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sân Ngon — Đặt sân thể thao ở Hà Nội',
  description:
    'Xem lịch trống thật của từng sân bóng, cầu lông, pickleball, tennis ở Hà Nội. Chốt sân bằng cọc chuyển khoản, khỏi gọi điện.',
  openGraph: {
    title: 'Sân trống tối nay, biết ngay trong 10 giây',
    description: 'Lịch trống thật, cọc 30% qua QR, phần còn lại trả tại sân.',
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
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-5 py-14 lg:flex-row lg:gap-12 lg:px-16 lg:py-18">
        <div className="flex w-full flex-col gap-6 lg:w-[520px] lg:flex-none">
          <span className="pf-in self-start rounded-pill bg-[#16543F] px-3.5 py-1.5 text-[13px] font-medium text-[#A9C9B8]">
            Bóng đá · Cầu lông · Pickleball · Tennis
          </span>

          <h1 style={{ animationDelay: '70ms' }} className="pf-in font-display text-[38px] font-extrabold leading-[1.06] tracking-[-0.03em] text-white lg:text-[56px]">
            Sân trống tối nay, biết ngay trong 10 giây.
          </h1>

          <p style={{ animationDelay: '140ms' }} className="pf-in text-base leading-7 text-[#A9C9B8] lg:text-lg lg:leading-8">
            Xem lịch trống thật của từng sân, chốt bằng tiền cọc chuyển khoản. Không gọi điện,
            không chờ chủ sân nghe máy, không sợ tới nơi mới biết hết chỗ.
          </p>

          <div style={{ animationDelay: '210ms' }} className="pf-in"><SearchBar /></div>

          <div style={{ animationDelay: '280ms' }} className="pf-in flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#A9C9B8]">
            <span>Miễn phí cho người đặt</span>
            <span>Cọc 30%, phần còn lại trả tại sân</span>
          </div>
        </div>

        <div style={{ animationDelay: '160ms' }} className="pf-in relative w-full flex-grow">
          <PitchNight className="h-64 w-full rounded-card object-cover lg:h-[430px]" />
          {grid}
        </div>
      </div>
    </section>
  );
}

function SearchBar() {
  // Không cho chọn ngày đã qua; chân trời đặt trước do từng cụm sân quyết định
  // nên chỉ chặn mốc dưới ở đây.
  const today = ymd(new Date());

  // Cột trái của hero rộng 520px, xếp bốn ô thành một hàng thì nút bấm tràn ra
  // ngoài và chui xuống dưới ảnh — lưới hai cột, nút chiếm trọn hàng thứ hai.
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
  const items = [
    [String(venues), 'cụm sân đang nhận đặt'],
    [String(courts), 'sân con trong hệ thống'],
    [String(districts), 'quận ở Hà Nội'],
    ['15 giây', 'từ chuyển khoản tới xác nhận'],
  ];
  return (
    <section className="border-b border-hairline bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-7 lg:grid-cols-4 lg:px-16">
        {items.map(([v, l]) => (
          <div key={l} className="flex flex-col gap-0.5">
            <span className="font-display text-2xl font-bold text-pitch">{v}</span>
            <span className="text-[13px] text-ink-secondary">{l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['Xem lịch thật', 'Cả ngày của cả cụm sân trong một màn hình, dù là bốn sân bóng hay sáu sân cầu lông. Khung nào bận đã xám sẵn, giá hiện luôn.'],
    ['Chọn và giữ chỗ', 'Bấm khung giờ, để lại số điện thoại. Sân được giữ 15 phút cho bạn kịp mở app ngân hàng.'],
    ['Quét QR là xong', 'Chuyển khoản xong đợi vài giây, màn hình tự chuyển sang Đã xác nhận. Chủ sân nhận tin ngay lúc đó.'],
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-16 lg:py-18">
      <div className="max-w-xl">
        <h2 className="font-display text-3xl font-extrabold tracking-tight lg:text-4xl">Ba bước, không cuộc gọi nào</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-secondary">
          Bóng đá, cầu lông, pickleball hay tennis đều chung một nỗi khổ: muốn biết còn sân không
          thì phải gọi, và thường gọi trượt vài cuộc mới ra chỗ.
        </p>
      </div>

      <div className="mt-9 grid gap-5 lg:grid-cols-3">
        {steps.map(([title, body], i) => (
          <Reveal key={title} delay={i * 90} className="flex">
            <div className="flex flex-col gap-3 rounded-[16px] border border-hairline bg-card p-6">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-free-fill text-[15px] font-bold text-pitch">
              {i + 1}
            </span>
            <span className="text-lg font-semibold">{title}</span>
            <p className="text-[15px] leading-relaxed text-ink-secondary">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function WhyDeposit() {
  return (
    <section className="mx-auto max-w-7xl px-5 lg:px-16">
      <div className="flex flex-col gap-10 rounded-[20px] border border-hairline bg-card p-7 lg:flex-row lg:gap-14 lg:p-12">
        <div className="flex flex-col gap-4 lg:w-[520px] lg:flex-none">
          <h2 className="font-display text-[28px] font-extrabold tracking-tight lg:text-[32px]">Vì sao phải đặt cọc?</h2>
          <p className="text-base leading-7 text-ink-secondary">
            Vì lời hứa qua điện thoại không ràng buộc ai. Chủ sân từ chối khách khác để giữ chỗ cho
            bạn, rồi tới giờ không thấy ai tới.
          </p>
          <p className="text-base leading-7 text-ink-secondary">
            Cọc 30% đổi lời hứa đó thành cam kết. Bảy mươi phần trăm còn lại bạn trả tại sân như
            vẫn làm xưa nay, chủ sân không phải đổi thói quen gì.
          </p>
        </div>

        <div className="flex flex-grow flex-col gap-3.5 rounded-[16px] bg-free-fill p-7">
          <span className="text-sm text-[#2C4A3C]">Ví dụ một buổi hai tiếng giờ vàng, sân bóng 5 người</span>
          <div className="flex flex-col gap-3 text-base">
            <Line label="Tổng tiền sân" value="700.000đ" />
            <Line label="Cọc trước qua QR" value="210.000đ" />
            <div className="h-px bg-strong" />
            <Line label="Trả tại sân" value="490.000đ" />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-[#2C4A3C]">
            Chia đầu người nhóm 10: mỗi người góp 21.000đ trước, 49.000đ tại sân.
          </p>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#2C4A3C]">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ForOwners() {
  return (
    <section className="mt-16 bg-pitch lg:mt-18">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-14 lg:flex-row lg:items-center lg:gap-14 lg:px-16 lg:py-16">
        <div className="flex flex-grow flex-col gap-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-[#A9C9B8]">Dành cho chủ sân</span>
          <h2 className="max-w-lg font-display text-3xl font-extrabold leading-tight tracking-tight text-white lg:text-4xl">
            Không nghe máy vẫn không mất kèo
          </h2>
          <p className="max-w-xl text-base leading-7 text-[#A9C9B8]">
            Bạn đang ở ngoài sân, tay bận, trời ồn. Mỗi cuộc gọi lỡ là một khung giờ trống. Đăng sân
            lên đây, khách tự xem lịch tự đặt, và bạn nhận tin báo ngay khi có đơn mới.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/dang-ky-san" className="flex h-13 items-center rounded-control bg-card px-7 text-base font-semibold text-pitch">
              Đăng sân của bạn
            </Link>
            <Link href="/chu-san" className="flex h-13 items-center rounded-control border border-[#2F6350] px-7 text-base font-semibold text-white">
              Xem thử trang quản lý
            </Link>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-[16px] bg-card p-5 lg:w-[420px] lg:flex-none">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pitch text-[13px] font-semibold text-pitch-ink">SN</span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Sân Ngon</span>
              <span className="text-xs text-ink-secondary">16:42</span>
            </div>
          </div>
          <div className="h-px bg-hairline" />
          <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
            <span className="font-bold">Đơn mới SANJ4K7WP</span>
            <span>Sân bóng Mỹ Đình — Sân 2</span>
            <span className="tabular-nums">Th 5, 18/09 18:00</span>
            <span>Nguyễn Minh Đức · 0912 345 678</span>
            <span className="font-semibold text-success">Đã cọc 210.000đ · thu tại sân 490.000đ</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const qa = [
    ['Xem lịch có phải đăng nhập không?', 'Không. Chỉ khi bấm đặt mới cần, để chủ sân biết ai đặt và gọi được nếu có thay đổi.'],
    ['Trời mưa không đá được thì sao?', 'Chủ sân thường cho đổi sang khung khác, cọc chuyển thẳng sang giờ mới. Nếu không đổi được thì hoàn lại cọc.'],
    ['Hai nhóm bấm đặt cùng lúc thì ai được?', 'Người bấm trước. Người sau nhận thông báo ngay và lưới lịch cập nhật lại, không có chuyện hai nhóm cùng tới một sân.'],
    ['Đặt xong mà không chuyển khoản?', 'Sau 15 phút đơn tự hủy và khung giờ mở lại cho người khác. Không mất phí gì.'],
  ];

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 lg:flex-row lg:gap-14 lg:px-16 lg:py-18">
      <h2 className="font-display text-[28px] font-extrabold tracking-tight lg:w-80 lg:flex-none lg:text-[32px]">
        Câu hỏi thường gặp
      </h2>
      <div className="flex flex-grow flex-col">
        {qa.map(([q, a], i) => (
          <div
            key={q}
            className={`flex flex-col gap-2 border-t border-hairline py-5 ${i === qa.length - 1 ? 'border-b' : ''}`}
          >
            <span className="text-[17px] font-semibold">{q}</span>
            <p className="text-[15px] leading-relaxed text-ink-secondary">{a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
